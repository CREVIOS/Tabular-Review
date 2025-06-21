# api/tabular_reviews.py - COMPLETE VERSION WITH FOLDER SUPPORT AND REAL-TIME UPDATES
from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks, Request, Query
from fastapi.responses import StreamingResponse, Response
from fastapi.encoders import jsonable_encoder
from typing import List, Optional, Dict, Set
import uuid
from datetime import datetime, timedelta
import json
import google.generativeai as genai
import asyncio
import threading
import queue
from collections import defaultdict, deque
import time
import os
import csv
import io
from dateutil.parser import isoparse
from core.sse_bus import publish, listen    
from core.supabase_create import get_supabase_admin
from schemas.tabular_reviews import (
    TabularReviewCreate,
    TabularReviewResponse,
    TabularReviewDetailResponse,
    TabularReviewListResponse,
    TabularReviewUpdate,
    TabularReviewColumnResponse,
    TabularReviewColumnUpdate,
    TabularReviewFileResponse,
    TabularReviewResultResponse,
    TabularReviewResultUpdate,
    AnalysisRequest,
    AnalysisStatus,
    AddFilesToReviewRequest,
    AddColumnToReviewRequest,
    ExportRequest,
    ExportFormat,
    BulkValidationRequest,
    ValidationStats,
    ReviewSummary,
    ReviewScope,
    ReviewStatus
)
from api.auth import get_current_user, verify_token

router = APIRouter()

# Initialize Gemini
# genai.configure(api_key=os.getenv("GEMINI_API_KEY"))

def parse_iso_datetime(dt_str: str) -> datetime:
    """Robustly parse an ISO‐8601 string into a datetime"""
    return isoparse(dt_str.strip())


# ------------------------------------------------------------------
# keep all *in-process* data structures exactly as they are
# ------------------------------------------------------------------

def _fanout_local(event: dict):
    """Deliver an already-built event to every queue in THIS worker only."""
    user_id = event["user_id"]
    message  = f"data: {json.dumps(event)}\n\n"

    with sse_lock:
        queues = sse_connections.get(user_id, set()).copy()

    dead = set()
    for q in queues:
        try:
            q.put_nowait(message)
        except queue.Full:
            dead.add(q)

    # house-keeping
    if dead:
        with sse_lock:
            for q in dead:
                sse_connections[user_id].discard(q)


# ============================================================================
# ENHANCED REAL-TIME SYSTEM WITH EVENT BUFFERING AND FOLDER SUPPORT
# ============================================================================

# Global storage for SSE connections and event buffering
sse_connections: Dict[str, Set[queue.Queue]] = {}
sse_lock = threading.Lock()

# Event buffer to store recent events for late-connecting clients
event_buffer: Dict[str, deque] = defaultdict(lambda: deque(maxlen=100))  # Keep last 100 events per review
buffer_lock = threading.Lock()

def add_sse_connection(user_id: str, connection_queue: queue.Queue):
    """Add a new SSE connection for a user"""
    with sse_lock:
        if user_id not in sse_connections:
            sse_connections[user_id] = set()
        sse_connections[user_id].add(connection_queue)

def remove_sse_connection(user_id: str, connection_queue: queue.Queue):
    """Remove an SSE connection for a user"""
    with sse_lock:
        if user_id in sse_connections:
            sse_connections[user_id].discard(connection_queue)
            if not sse_connections[user_id]:
                del sse_connections[user_id]

def broadcast_to_user(user_id: str, data: dict):
    """Broadcast data to all SSE connections for a user and buffer the event"""
    # Add timestamp to the data
    data |= {
        "user_id": user_id,
        "server_timestamp": time.time(),
        "broadcast_time": datetime.utcnow().isoformat(),
    }

    asyncio.create_task(publish(data))   
    _fanout_local(data)
    
    # Buffer the event for late-connecting clients
    review_id = data.get("review_id")
    if review_id:
        with buffer_lock:
            event_buffer[review_id].append(data)
            print(f"🗃️  Buffered event {data['type']} for review {review_id} (buffer size: {len(event_buffer[review_id])})")
    
    # Broadcast to active connections
    with sse_lock:
        if user_id in sse_connections:
            message = f"data: {json.dumps(data)}\n\n"
            dead_connections = set()
            active_connections = len(sse_connections[user_id])
            
            print(f"📡 Broadcasting {data['type']} to {active_connections} active SSE connections")
            
            for connection_queue in sse_connections[user_id]:
                try:
                    connection_queue.put_nowait(message)
                except queue.Full:
                    dead_connections.add(connection_queue)
            
            # Remove dead connections
            for dead_conn in dead_connections:
                sse_connections[user_id].discard(dead_conn)

# ============================================================================
# SSE STREAMING ENDPOINT WITH EVENT REPLAY
# ============================================================================

@router.get("/{review_id}/stream")
async def stream_review_updates(
    review_id: str,
    token: str = Query(...)
):
    """Stream real‐time updates for a tabular review via SSE with event replay."""
    
    # Authentication & authorization
    try:
        user_id = verify_token(token)
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token")
    except:
        raise HTTPException(status_code=401, detail="Invalid token")

    supabase = get_supabase_admin()
    resp = supabase.table("tabular_reviews") \
                   .select("id") \
                   .eq("id", review_id) \
                   .eq("user_id", user_id) \
                   .execute()
    if not resp.data:
        raise HTTPException(status_code=404, detail="Review not found")

    # Set up a per‐client queue and register it
    client_queue: queue.Queue = queue.Queue()
    add_sse_connection(user_id, client_queue)

    print(f"🔌 New SSE connection established for review {review_id}")

    async def event_stream():
        # Send initial "connected" event
        yield f"data: {json.dumps({'type': 'connected', 'review_id': review_id, 'timestamp': datetime.utcnow().isoformat()})}\n\n"

        # REPLAY BUFFERED EVENTS for this review
        with buffer_lock:
            buffered_events = list(event_buffer[review_id])
        
        print(f"🔄 Replaying {len(buffered_events)} buffered events for review {review_id}")
        for event in buffered_events:
            # Add replay flag
            event_copy = event.copy()
            event_copy['replayed'] = True
            yield f"data: {json.dumps(event_copy)}\n\n"

        last_hb = datetime.utcnow()
        try:
            while True:
                # Drain all pending messages
                try:
                    msg = client_queue.get_nowait()
                    yield msg
                    continue
                except queue.Empty:
                    pass

                # Send a heartbeat every 30s
                if datetime.utcnow() - last_hb > timedelta(seconds=30):
                    yield f"data: {json.dumps({'type': 'heartbeat', 'timestamp': datetime.utcnow().isoformat()})}\n\n"
                    last_hb = datetime.utcnow()

                await asyncio.sleep(1)
        except asyncio.CancelledError:
            print(f"🔌 SSE client disconnected for review {review_id}")
        finally:
            remove_sse_connection(user_id, client_queue)

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "*",
            "Access-Control-Allow-Methods": "GET, OPTIONS",
            "X-Accel-Buffering": "no"
        }
    )

# ============================================================================
# AI PROCESSING FUNCTIONS
# ============================================================================

async def analyze_document_with_gemini(document_content: str, prompts: List[dict]) -> List[dict]:
    """Use Gemini to extract data from document based on prompts"""
    try:
        model = genai.GenerativeModel('gemini-1.5-flash')
        
        # Create a comprehensive prompt for Gemini
        analysis_prompt = f"""
You are an expert document analyst. Analyze the following document and extract specific information based on the given prompts.

Document Content:
{document_content[:10000]}  # Limit content to avoid token limits

Analysis Tasks:
"""
        
        for i, prompt_info in enumerate(prompts):
            analysis_prompt += f"""
{i+1}. Column: {prompt_info['column_name']}
   Task: {prompt_info['prompt']}
   Column ID: {prompt_info['column_id']}
   Expected Data Type: {prompt_info.get('data_type', 'text')}
"""
        
        analysis_prompt += """

Instructions:
1. For each analysis task, extract the requested information from the document
2. If information is not found, return null for the value
3. Provide a confidence score between 0.0 and 1.0
4. Include a source reference (page number, section, or specific text location)
5. Format values according to the expected data type
6. Return your response as a JSON array with this exact structure:

[
  {
    "column_id": "uuid-here",
    "value": "extracted_value_or_null",
    "confidence": 0.95,
    "source": "Page 1, Section 2.1" 
  }
]

Important: Return ONLY the JSON array, no other text or explanation.
"""
        
        response = model.generate_content(analysis_prompt)
        response_text = response.text.strip()
        
        # Clean the response to extract just the JSON
        if response_text.startswith('```json'):
            response_text = response_text[7:]
        if response_text.endswith('```'):
            response_text = response_text[:-3]
        
        try:
            extractions = json.loads(response_text)
            return extractions
        except json.JSONDecodeError:
            print(f"Failed to parse Gemini response as JSON: {response_text}")
            return [{"column_id": p["column_id"], "value": None, "confidence": 0.0, "source": "Analysis failed"} for p in prompts]
            
    except Exception as e:
        print(f"Gemini analysis failed: {str(e)}")
        return [{"column_id": p["column_id"], "value": None, "confidence": 0.0, "source": "Analysis failed"} for p in prompts]

async def process_single_cell_immediate(review_id: str, file_id: str, column: dict, user_id: str, progress_tracker: dict):
    """Process a single cell immediately with real-time updates"""
    try:
        print(f"📊 Starting cell: {file_id} x {column['column_name']}")
        
        # Send immediate processing start notification
        broadcast_to_user(user_id, {
            'type': 'cell_processing_started',
            'review_id': review_id,
            'file_id': file_id,
            'column_id': column["id"],
            'message': f'Analyzing {column["column_name"]}...'
        })
        
        # Get markdown content
        supabase_admin = get_supabase_admin()
        markdown_response = supabase_admin.table("markdown_content").select("content").eq("file_id", file_id).eq("user_id", user_id).execute()
        
        if not markdown_response.data:
            progress_tracker['completed'] += 1
            return
            
        document_content = markdown_response.data[0]["content"]
        
        # Call Gemini for this specific cell
        prompt_info = {
            "column_id": column["id"],
            "column_name": column["column_name"],
            "prompt": column["prompt"],
            "data_type": column.get("data_type", "text")
        }
        
        extractions = await analyze_document_with_gemini(document_content, [prompt_info])
        extraction = extractions[0] if extractions else {}
        
        # Store result immediately
        result_record = {
            "id": str(uuid.uuid4()),
            "review_id": review_id,
            "file_id": file_id,
            "column_id": column["id"],
            "extracted_value": extraction.get("value"),
            "confidence_score": extraction.get("confidence", 0.0),
            "source_reference": extraction.get("source", ""),
            "created_at": datetime.utcnow().isoformat(),
            "updated_at": datetime.utcnow().isoformat()
        }
        
        # Upsert result
        supabase_admin.table("tabular_review_results").upsert(result_record, on_conflict="review_id,file_id,column_id").execute()
        
        progress_tracker['completed'] += 1
        progress_percentage = (progress_tracker['completed'] / progress_tracker['total']) * 100
        
        print(f"✅ Cell completed: {file_id} x {column['column_name']} = {extraction.get('value', 'No data')}")
        
        # Send immediate cell completion update
        broadcast_to_user(user_id, {
            'type': 'cell_completed',
            'review_id': review_id,
            'file_id': file_id,
            'column_id': column["id"],
            'result': {
                'extracted_value': extraction.get("value"),
                'confidence_score': extraction.get("confidence", 0.0),
                'source_reference': extraction.get("source", "")
            },
            'progress': progress_percentage,
            'timestamp': datetime.utcnow().isoformat()
        })
        
    except Exception as e:
        print(f"❌ Error processing cell {file_id}-{column['id']}: {str(e)}")
        progress_tracker['completed'] += 1
        
        # Send immediate error update
        broadcast_to_user(user_id, {
            'type': 'cell_error',
            'review_id': review_id,
            'file_id': file_id,
            'column_id': column["id"],
            'error': str(e),
            'timestamp': datetime.utcnow().isoformat()
        })

async def process_review_analysis_realtime(review_id: str, user_id: str):
    """Process complete review analysis with immediate real-time updates"""
    try:
        supabase_admin = get_supabase_admin()
        
        print(f"🚀 Starting immediate review analysis for {review_id}")
        
        # Send start message
        broadcast_to_user(user_id, {
            'type': 'analysis_started',
            'review_id': review_id,
            'message': 'Starting document analysis...'
        })
        
        # Get review details
        review_response = supabase_admin.table("tabular_reviews").select("*").eq("id", review_id).execute()
        if not review_response.data:
            return
        
        # Get columns and files
        columns_response = supabase_admin.table("tabular_review_columns").select("*").eq("review_id", review_id).order("column_order").execute()
        files_response = supabase_admin.table("tabular_review_files").select("file_id").eq("review_id", review_id).execute()
        
        total_tasks = len(files_response.data) * len(columns_response.data)
        progress_tracker = {'completed': 0, 'total': total_tasks}
        
        print(f"📊 Total cells to process: {total_tasks}")
        
        # Create tasks for all cells to process them concurrently (with concurrency limit)
        semaphore = asyncio.Semaphore(5)  # Limit concurrent processing
        
        async def process_with_semaphore(file_data, column):
            async with semaphore:
                await process_single_cell_immediate(review_id, file_data["file_id"], column, user_id, progress_tracker)
        
        tasks = []
        for file_data in files_response.data:
            for column in columns_response.data:
                task = asyncio.create_task(process_with_semaphore(file_data, column))
                tasks.append(task)
        
        # Wait for all cells to complete
        await asyncio.gather(*tasks, return_exceptions=True)
        
        # Update review status to completed
        supabase_admin.table("tabular_reviews").update({
            "status": "completed",
            "last_processed_at": datetime.utcnow().isoformat()
        }).eq("id", review_id).execute()
        
        print(f"🎉 Analysis completed for review {review_id}")
        
        # Send completion message
        broadcast_to_user(user_id, {
            'type': 'analysis_completed',
            'review_id': review_id,
            'message': 'Analysis completed successfully!',
            'progress': 100
        })
        
    except Exception as e:
        print(f"💥 Analysis failed for review {review_id}: {str(e)}")
        
        # Update review status to failed
        supabase_admin = get_supabase_admin()
        supabase_admin.table("tabular_reviews").update({
            "status": "failed",
            "last_processed_at": datetime.utcnow().isoformat()
        }).eq("id", review_id).execute()
        
        # Send error message
        broadcast_to_user(user_id, {
            'type': 'analysis_failed',
            'review_id': review_id,
            'error': str(e),
            'message': 'Analysis failed. Please try again.'
        })

# ============================================================================
# FOLDER INTEGRATION FUNCTIONS
# ============================================================================

async def get_files_from_folder(folder_id: str, user_id: str) -> List[str]:
    """Get all completed files from a folder"""
    try:
        supabase_admin = get_supabase_admin()
        
        # Get files in folder that are completed
        files_response = supabase_admin.table("files")\
            .select("id")\
            .eq("folder_id", folder_id)\
            .eq("user_id", user_id)\
            .eq("status", "completed")\
            .execute()
        
        return [f["id"] for f in files_response.data]
    except Exception as e:
        print(f"Error getting files from folder {folder_id}: {str(e)}")
        return []

async def validate_folder_access(folder_id: str, user_id: str) -> bool:
    """Validate that user has access to the folder"""
    try:
        supabase_admin = get_supabase_admin()
        
        folder_response = supabase_admin.table("folders")\
            .select("id")\
            .eq("id", folder_id)\
            .eq("user_id", user_id)\
            .execute()
        
        return len(folder_response.data) > 0
    except Exception as e:
        print(f"Error validating folder access: {str(e)}")
        return False

# ============================================================================
# CRUD ENDPOINTS
# ============================================================================

@router.post("/", response_model=TabularReviewResponse)
async def create_tabular_review(
    review_data: TabularReviewCreate,
    background_tasks: BackgroundTasks,
    current_user = Depends(get_current_user)
):
    """Create a new tabular review with folder or file support"""
    try:
        supabase_admin = get_supabase_admin()
        
        print(f"🎯 Creating new tabular review: {review_data.name} (scope: {review_data.review_scope})")
        
        file_ids = []
        
        # Handle different review scopes
        if review_data.review_scope == ReviewScope.FOLDER:
            if not review_data.folder_id:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="folder_id is required for folder-based reviews"
                )
            
            # Validate folder access
            if not await validate_folder_access(review_data.folder_id, current_user.id):
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Folder not found or access denied"
                )
            
            # Get all completed files from folder
            file_ids = await get_files_from_folder(review_data.folder_id, current_user.id)
            
            if not file_ids:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="No completed files found in the selected folder"
                )
                
        elif review_data.review_scope == ReviewScope.FILES:
            if not review_data.file_ids:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="file_ids is required for file-based reviews"
                )
            
            # Validate that all files belong to the user and are completed
            files_response = supabase_admin.table("files").select("id, original_filename, file_size, status, folder_id").in_("id", review_data.file_ids).eq("user_id", current_user.id).execute()
            
            if len(files_response.data) != len(review_data.file_ids):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Some files not found or don't belong to user"
                )
            
            # Check if all files are completed
            incomplete_files = [f for f in files_response.data if f["status"] != "completed"]
            if incomplete_files:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="All files must be completed before creating a review"
                )
            
            file_ids = review_data.file_ids
        
        # Create the review
        review_id = str(uuid.uuid4())
        review_record = {
            "id": review_id,
            "user_id": current_user.id,
            "name": review_data.name,
            "description": review_data.description,
            "status": "processing",
            "review_scope": review_data.review_scope,
            "folder_id": review_data.folder_id if review_data.review_scope == ReviewScope.FOLDER else None,
            "created_at": datetime.utcnow().isoformat(),
            "updated_at": datetime.utcnow().isoformat(),
            "last_processed_at": datetime.utcnow().isoformat()
        }
        
        review_response = supabase_admin.table("tabular_reviews").insert(review_record).execute()
        
        if hasattr(review_response, 'error') and review_response.error:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to create review: {review_response.error}"
            )
        
        # Create columns
        column_records = []
        for i, column in enumerate(review_data.columns):
            column_id = str(uuid.uuid4())
            column_records.append({
                "id": column_id,
                "review_id": review_id,
                "column_name": column.column_name,
                "prompt": column.prompt,
                "column_order": column.column_order if column.column_order is not None else i,
                "data_type": column.data_type,
                "created_at": datetime.utcnow().isoformat()
            })
        
        columns_response = supabase_admin.table("tabular_review_columns").insert(column_records).execute()
        
        if hasattr(columns_response, 'error') and columns_response.error:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to create columns: {columns_response.error}"
            )
        
        # Link files to review
        file_records = []
        files_info = []
        
        if review_data.review_scope == ReviewScope.FILES:
            # Use the validated files_response from above
            files_info = files_response.data
        else:
            # Get file info for folder-based review
            files_response = supabase_admin.table("files").select("id, original_filename, file_size, status, folder_id").in_("id", file_ids).eq("user_id", current_user.id).execute()
            files_info = files_response.data
        
        for file_id in file_ids:
            file_records.append({
                "id": str(uuid.uuid4()),
                "review_id": review_id,
                "file_id": file_id,
                "added_at": datetime.utcnow().isoformat()
            })
        
        files_link_response = supabase_admin.table("tabular_review_files").insert(file_records).execute()
        
        if hasattr(files_link_response, 'error') and files_link_response.error:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to link files: {files_link_response.error}"
            )
        
        print(f"✅ Review created: {review_id}, starting immediate analysis")
        
        # Automatically start immediate analysis
        asyncio.create_task(process_review_analysis_realtime(review_id, str(current_user.id)))
        
        # Return the created review
        return TabularReviewResponse(
            id=review_id,
            user_id=current_user.id,
            name=review_data.name,
            description=review_data.description,
            status="processing",
            review_scope=review_data.review_scope,
            folder_id=review_data.folder_id if review_data.review_scope == ReviewScope.FOLDER else None,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
            last_processed_at=datetime.utcnow(),
            columns=[
                TabularReviewColumnResponse(
                    id=column_record["id"],
                    column_name=column_record["column_name"],
                    prompt=column_record["prompt"],
                    column_order=column_record["column_order"],
                    data_type=column_record["data_type"],
                    created_at=datetime.utcnow()
                ) for column_record in column_records
            ],
            files=[
                TabularReviewFileResponse(
                    id=file_record["id"],
                    file_id=file_record["file_id"],
                    filename=next(f["original_filename"] for f in files_info if f["id"] == file_record["file_id"]),
                    file_size=next(f["file_size"] for f in files_info if f["id"] == file_record["file_id"]),
                    status=next(f["status"] for f in files_info if f["id"] == file_record["file_id"]),
                    added_at=datetime.utcnow()
                ) for file_record in file_records
            ],
            total_files=len(file_records),
            total_columns=len(column_records),
            completion_percentage=0.0
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create tabular review: {str(e)}"
        )

@router.get("/", response_model=TabularReviewListResponse)
async def list_tabular_reviews(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    status_filter: Optional[str] = Query(None),
    folder_id: Optional[str] = Query(None),
    current_user = Depends(get_current_user)
):
    """Get list of user's tabular reviews with filtering and pagination"""
    try:
        supabase_admin = get_supabase_admin()
        
        # Build query
        query = supabase_admin.table("tabular_reviews").select("*", count="exact").eq("user_id", current_user.id)
        
        # Apply filters
        if status_filter:
            query = query.eq("status", status_filter)
        if folder_id:
            query = query.eq("folder_id", folder_id)
        
        # Get total count
        count_response = await asyncio.to_thread(query.execute)
        total_count = count_response.count or 0
        
        # Get reviews with pagination
        offset = (page - 1) * page_size
        reviews_response = supabase_admin.table("tabular_reviews")\
            .select("*")\
            .eq("user_id", current_user.id)\
            .order("created_at", desc=True)\
            .range(offset, offset + page_size - 1)
        
        # Apply same filters to paginated query
        if status_filter:
            reviews_response = reviews_response.eq("status", status_filter)
        if folder_id:
            reviews_response = reviews_response.eq("folder_id", folder_id)
        
        reviews_data = reviews_response.execute()
        
        reviews = []
        for review_data in reviews_data.data:
            # Get columns count
            columns_response = supabase_admin.table("tabular_review_columns").select("id", count="exact").eq("review_id", review_data["id"]).execute()
            
            # Get files count
            files_response = supabase_admin.table("tabular_review_files").select("file_id").eq("review_id", review_data["id"]).execute()
            
            # Get results count for completion percentage
            results_response = supabase_admin.table("tabular_review_results").select("id", count="exact").eq("review_id", review_data["id"]).execute()
            
            total_possible_results = len(files_response.data) * (columns_response.count or 0)
            completion_percentage = (results_response.count / total_possible_results * 100) if total_possible_results > 0 else 0
            
            # Parse dates
            created_at = parse_iso_datetime(review_data["created_at"])
            updated_at = parse_iso_datetime(review_data["updated_at"])
            last_processed_at = None
            if review_data.get("last_processed_at"):
                last_processed_at = parse_iso_datetime(review_data["last_processed_at"])
            
            reviews.append(TabularReviewResponse(
                id=review_data["id"],
                user_id=review_data["user_id"],
                name=review_data["name"],
                description=review_data.get("description"),
                status=review_data["status"],
                review_scope=review_data.get("review_scope") or "files",
                folder_id=review_data.get("folder_id"),
                created_at=created_at,
                updated_at=updated_at,
                last_processed_at=last_processed_at,
                columns=[],  # Empty for list view
                files=[],    # Empty for list view
                total_files=len(files_response.data),
                total_columns=columns_response.count or 0,
                completion_percentage=completion_percentage
            ))
        
        total_pages = (total_count + page_size - 1) // page_size
        
        return TabularReviewListResponse(
            reviews=reviews,
            total_count=total_count,
            page=page,
            page_size=page_size,
            total_pages=total_pages
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch reviews: {str(e)}"
        )

@router.get("/{review_id}", response_model=TabularReviewDetailResponse)
async def get_tabular_review(
    review_id: str,
    include_results: bool = Query(True),
    current_user = Depends(get_current_user)
):
    """Get detailed tabular review with optional results"""
    try:
        supabase_admin = get_supabase_admin()
        
        # Get review
        review_response = supabase_admin.table("tabular_reviews").select("*").eq("id", review_id).eq("user_id", current_user.id).execute()
        
        if not review_response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Review not found"
            )
        
        review_data = review_response.data[0]
        
        # Get columns
        columns_response = supabase_admin.table("tabular_review_columns").select("*").eq("review_id", review_id).order("column_order").execute()
        
        # Get files with details
        files_response = supabase_admin.table("tabular_review_files")\
            .select("*, files(original_filename, file_size, status)")\
            .eq("review_id", review_id)\
            .execute()
        
        # Get results if requested
        results = []
        if include_results:
            results_response = supabase_admin.table("tabular_review_results").select("*").eq("review_id", review_id).execute()
            
            for result_data in results_response.data:
                result_created_at = parse_iso_datetime(result_data["created_at"])
                results.append(TabularReviewResultResponse(
                    id=result_data["id"],
                    file_id=result_data["file_id"],
                    column_id=result_data["column_id"],
                    extracted_value=result_data.get("extracted_value"),
                    confidence_score=result_data.get("confidence_score"),
                    source_reference=result_data.get("source_reference"),
                    created_at=result_created_at
                ))
        
        # Parse dates
        created_at = parse_iso_datetime(review_data["created_at"])
        updated_at = parse_iso_datetime(review_data["updated_at"])
        last_processed_at = None
        if review_data.get("last_processed_at"):
            last_processed_at = parse_iso_datetime(review_data["last_processed_at"])
        
        # Build response
        columns = []
        for col_data in columns_response.data:
            col_created_at = parse_iso_datetime(col_data["created_at"])
            columns.append(TabularReviewColumnResponse(
                id=col_data["id"],
                column_name=col_data["column_name"],
                prompt=col_data["prompt"],
                column_order=col_data["column_order"],
                data_type=col_data["data_type"],
                created_at=col_created_at
            ))
        
        files = []
        for file_data in files_response.data:
            file_added_at = parse_iso_datetime(file_data["added_at"])
            files.append(TabularReviewFileResponse(
                id=file_data["id"],
                file_id=file_data["file_id"],
                filename=file_data["files"]["original_filename"],
                file_size=file_data["files"]["file_size"],
                status=file_data["files"]["status"],
                added_at=file_added_at
            ))
        
        total_possible_results = len(files) * len(columns)
        completion_percentage = (len(results) / total_possible_results * 100) if total_possible_results > 0 else 0
        
        return TabularReviewDetailResponse(
            id=review_data["id"],
            user_id=review_data["user_id"],
            name=review_data["name"],
            description=review_data.get("description"),
            status=review_data["status"],
            review_scope=review_data.get("review_scope") or "files",
            folder_id=review_data.get("folder_id"),
            created_at=created_at,
            updated_at=updated_at,
            last_processed_at=last_processed_at,
            columns=columns,
            files=files,
            total_files=len(files),
            total_columns=len(columns),
            completion_percentage=completion_percentage,
            results=results
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch review: {str(e)}"
        )

@router.post("/{review_id}/files")
async def add_files_to_review(
    review_id: str,
    request: AddFilesToReviewRequest,
    background_tasks: BackgroundTasks,
    current_user = Depends(get_current_user)
):
    """Add files to an existing review (only for file-based reviews)"""
    try:
        supabase_admin = get_supabase_admin()
        
        print(f"🎯 Adding {len(request.file_ids)} files to review {review_id}")
        
        # Verify review belongs to user and is file-based
        review_response = supabase_admin.table("tabular_reviews")\
            .select("id, status, review_scope")\
            .eq("id", review_id)\
            .eq("user_id", current_user.id)\
            .execute()
        
        if not review_response.data:
            raise HTTPException(status_code=404, detail="Review not found")
        
        review_data = review_response.data[0]
        
        if review_data["review_scope"] == "folder":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot manually add files to folder-based review"
            )
        
        # Verify files belong to user and are completed
        files_response = supabase_admin.table("files")\
            .select("id, original_filename, file_size, status")\
            .in_("id", request.file_ids)\
            .eq("user_id", current_user.id)\
            .execute()
        
        if len(files_response.data) != len(request.file_ids):
            raise HTTPException(status_code=400, detail="Some files not found or don't belong to user")
        
        # Check if all files are completed
        incomplete_files = [f for f in files_response.data if f["status"] != "completed"]
        if incomplete_files:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="All files must be completed before adding to review"
            )
        
        # Check for existing files in review
        existing_response = supabase_admin.table("tabular_review_files")\
            .select("file_id")\
            .eq("review_id", review_id)\
            .in_("file_id", request.file_ids)\
            .execute()
        
        existing_file_ids = [f['file_id'] for f in existing_response.data]
        new_file_ids = [fid for fid in request.file_ids if fid not in existing_file_ids]
        
        if not new_file_ids:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="All files are already in this review"
            )
        
        # Add new files
        file_records = []
        for file_id in new_file_ids:
            file_records.append({
                "id": str(uuid.uuid4()),
                "review_id": review_id,
                "file_id": file_id,
                "added_at": datetime.utcnow().isoformat()
            })
        
        insert_response = supabase_admin.table("tabular_review_files").insert(file_records).execute()
        
        if hasattr(insert_response, 'error') and insert_response.error:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to add files: {insert_response.error}"
            )
        
        # Update review status and timestamp
        supabase_admin.table("tabular_reviews").update({
            "status": "processing",
            "updated_at": datetime.utcnow().isoformat(),
            "last_processed_at": datetime.utcnow().isoformat()
        }).eq("id", review_id).execute()
        
        # Send immediate SSE notification
        broadcast_to_user(str(current_user.id), {
            'type': 'files_added',
            'review_id': review_id,
            'file_count': len(new_file_ids),
            'message': f'{len(new_file_ids)} documents added. Starting analysis...'
        })
        
        # Start analysis for new files immediately
        asyncio.create_task(analyze_new_files_immediate(review_id, new_file_ids, str(current_user.id)))
        
        return {"message": f"Added {len(new_file_ids)} files to review", "added_files": len(new_file_ids)}
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to add files: {str(e)}")

async def analyze_new_files_immediate(review_id: str, file_ids: List[str], user_id: str):
    """Analyze new files for all existing columns with immediate cell-by-cell updates"""
    try:
        supabase_admin = get_supabase_admin()
        
        print(f"🚀 Starting immediate files analysis for {len(file_ids)} files")
        
        # Send start message
        broadcast_to_user(user_id, {
            'type': 'files_analysis_started',
            'review_id': review_id,
            'file_ids': file_ids,
            'message': f'Starting analysis for {len(file_ids)} new documents...'
        })
        
        # Get all columns in the review
        columns_response = supabase_admin.table("tabular_review_columns").select("*").eq("review_id", review_id).order("column_order").execute()
        
        total_tasks = len(file_ids) * len(columns_response.data)
        progress_tracker = {'completed': 0, 'total': total_tasks}
        
        # Create tasks for all cells with concurrency limit
        semaphore = asyncio.Semaphore(5)
        
        async def process_with_semaphore(file_id, column):
            async with semaphore:
                await process_single_cell_immediate(review_id, file_id, column, user_id, progress_tracker)
        
        tasks = []
        for file_id in file_ids:
            for column in columns_response.data:
                task = asyncio.create_task(process_with_semaphore(file_id, column))
                tasks.append(task)
        
        # Wait for all cells to complete
        await asyncio.gather(*tasks, return_exceptions=True)
        
        print(f"🎉 Files analysis completed for {len(file_ids)} files")
        
        # Send files completion message
        broadcast_to_user(user_id, {
            'type': 'files_analysis_completed',
            'review_id': review_id,
            'file_ids': file_ids,
            'message': f'Analysis completed for {len(file_ids)} new documents!'
        })
        
    except Exception as e:
        print(f"💥 Files analysis failed for review {review_id}: {str(e)}")
        
        # Send error message
        broadcast_to_user(user_id, {
            'type': 'files_analysis_failed',
            'review_id': review_id,
            'file_ids': file_ids,
            'error': str(e),
            'message': 'Files analysis failed. Please try again.'
        })

async def analyze_new_column_immediate(review_id: str, column_id: str, user_id: str):
    """Analyze new column for all existing files with immediate cell-by-cell updates"""
    try:
        supabase_admin = get_supabase_admin()
        
        print(f"🚀 Starting immediate column analysis for {column_id}")
        
        # Send start message
        broadcast_to_user(user_id, {
            'type': 'column_analysis_started',
            'review_id': review_id,
            'column_id': column_id,
            'message': 'Starting analysis for new column...'
        })
        
        # Get column details
        column_response = supabase_admin.table("tabular_review_columns").select("*").eq("id", column_id).execute()
        if not column_response.data:
            return
        
        column = column_response.data[0]
        
        # Get all files in the review
        files_response = supabase_admin.table("tabular_review_files").select("file_id").eq("review_id", review_id).execute()
        
        total_files = len(files_response.data)
        progress_tracker = {'completed': 0, 'total': total_files}
        
        # Create tasks for all cells with concurrency limit
        semaphore = asyncio.Semaphore(5)
        
        async def process_with_semaphore(file_data):
            async with semaphore:
                await process_single_cell_immediate(review_id, file_data["file_id"], column, user_id, progress_tracker)
        
        tasks = []
        for file_data in files_response.data:
            task = asyncio.create_task(process_with_semaphore(file_data))
            tasks.append(task)
        
        # Wait for all cells to complete
        await asyncio.gather(*tasks, return_exceptions=True)
        
        print(f"🎉 Column analysis completed for {column['column_name']}")
        
        # Send column completion message
        broadcast_to_user(user_id, {
            'type': 'column_analysis_completed',
            'review_id': review_id,
            'column_id': column_id,
            'message': f'Column "{column["column_name"]}" analysis completed!'
        })
        
    except Exception as e:
        print(f"💥 Column analysis failed for review {review_id}, column {column_id}: {str(e)}")
        
        # Send error message
        broadcast_to_user(user_id, {
            'type': 'column_analysis_failed',
            'review_id': review_id,
            'column_id': column_id,
            'error': str(e),
            'message': 'Column analysis failed. Please try again.'
        })

@router.post("/{review_id}/columns")
async def add_column_to_review(
    review_id: str,
    request: AddColumnToReviewRequest,
    background_tasks: BackgroundTasks,
    current_user = Depends(get_current_user)
):
    """Add a new column to existing review and analyze for all files"""
    try:
        supabase_admin = get_supabase_admin()
        
        print(f"🎯 Adding column to review {review_id}: {request.column_name}")
        
        # Verify review belongs to user
        review_response = supabase_admin.table("tabular_reviews").select("id").eq("id", review_id).eq("user_id", current_user.id).execute()
        if not review_response.data:
            raise HTTPException(status_code=404, detail="Review not found")
        
        # Get current max order
        existing_columns = supabase_admin.table("tabular_review_columns").select("column_order").eq("review_id", review_id).execute()
        max_order = max([col["column_order"] for col in existing_columns.data], default=-1)
        
        # Create new column
        column_id = str(uuid.uuid4())
        column_record = {
            "id": column_id,
            "review_id": review_id,
            "column_name": request.column_name,
            "prompt": request.prompt,
            "column_order": max_order + 1,
            "data_type": request.data_type,
            "created_at": datetime.utcnow().isoformat()
        }
        
        # Insert column
        column_response = supabase_admin.table("tabular_review_columns").insert(column_record).execute()
        
        if hasattr(column_response, 'error') and column_response.error:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to create column: {column_response.error}"
            )
        
        # Update review status to processing
        supabase_admin.table("tabular_reviews").update({
            "status": "processing",
            "last_processed_at": datetime.utcnow().isoformat()
        }).eq("id", review_id).execute()
        
        # Send immediate SSE notification that column was added
        broadcast_to_user(str(current_user.id), {
            'type': 'column_added',
            'review_id': review_id,
            'column_id': column_id,
            'message': f'Column "{request.column_name}" added. Starting analysis...'
        })
        
        # Start analysis immediately
        asyncio.create_task(analyze_new_column_immediate(review_id, column_id, str(current_user.id)))
        
        return column_record
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to add column: {str(e)}")

@router.put("/{review_id}/columns/{column_id}")
async def update_column(
    review_id: str,
    column_id: str,
    request: TabularReviewColumnUpdate,
    current_user = Depends(get_current_user)
):
    """Update a column"""
    try:
        supabase_admin = get_supabase_admin()
        
        # Verify review and column belong to user
        review_response = supabase_admin.table("tabular_reviews").select("id").eq("id", review_id).eq("user_id", current_user.id).execute()
        if not review_response.data:
            raise HTTPException(status_code=404, detail="Review not found")
        
        column_response = supabase_admin.table("tabular_review_columns").select("*").eq("id", column_id).eq("review_id", review_id).execute()
        if not column_response.data:
            raise HTTPException(status_code=404, detail="Column not found")
        
        # Prepare update data
        update_data = {}
        if request.column_name is not None:
            update_data["column_name"] = request.column_name
        if request.prompt is not None:
            update_data["prompt"] = request.prompt
        if request.data_type is not None:
            update_data["data_type"] = request.data_type
        if request.column_order is not None:
            update_data["column_order"] = request.column_order
        
        if not update_data:
            raise HTTPException(status_code=400, detail="No fields to update")
        
        # Update column
        update_response = supabase_admin.table("tabular_review_columns").update(update_data).eq("id", column_id).execute()
        
        if hasattr(update_response, 'error') and update_response.error:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to update column: {update_response.error}"
            )
        
        # If prompt was changed, trigger re-analysis
        if request.prompt is not None:
            # Clear existing results for this column
            supabase_admin.table("tabular_review_results").delete().eq("review_id", review_id).eq("column_id", column_id).execute()
            
            # Update review status
            supabase_admin.table("tabular_reviews").update({
                "status": "processing",
                "last_processed_at": datetime.utcnow().isoformat()
            }).eq("id", review_id).execute()
            
            # Send notification
            broadcast_to_user(str(current_user.id), {
                'type': 'column_updated',
                'review_id': review_id,
                'column_id': column_id,
                'message': f'Column updated. Re-analyzing...'
            })
            
            # Start re-analysis
            asyncio.create_task(analyze_new_column_immediate(review_id, column_id, str(current_user.id)))
        
        return update_response.data[0]
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update column: {str(e)}")

@router.delete("/{review_id}/columns/{column_id}")
async def delete_column(
    review_id: str,
    column_id: str,
    current_user = Depends(get_current_user)
):
    """Delete a column from review"""
    try:
        supabase_admin = get_supabase_admin()
        
        # Verify review and column belong to user
        review_response = supabase_admin.table("tabular_reviews").select("id").eq("id", review_id).eq("user_id", current_user.id).execute()
        if not review_response.data:
            raise HTTPException(status_code=404, detail="Review not found")
        
        column_response = supabase_admin.table("tabular_review_columns").select("*").eq("id", column_id).eq("review_id", review_id).execute()
        if not column_response.data:
            raise HTTPException(status_code=404, detail="Column not found")
        
        # Delete column (cascade will delete results)
        delete_response = supabase_admin.table("tabular_review_columns").delete().eq("id", column_id).execute()
        
        if hasattr(delete_response, 'error') and delete_response.error:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to delete column: {delete_response.error}"
            )
        
        # Send notification
        broadcast_to_user(str(current_user.id), {
            'type': 'column_deleted',
            'review_id': review_id,
            'column_id': column_id,
            'message': 'Column deleted successfully'
        })
        
        return {"message": "Column deleted successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete column: {str(e)}")

@router.post("/{review_id}/analyze")
async def start_analysis(
    review_id: str,
    analysis_request: Optional[AnalysisRequest] = None,
    current_user = Depends(get_current_user)
):
    """Start or restart AI analysis for a tabular review"""
    try:
        supabase_admin = get_supabase_admin()
        
        print(f"🎯 Manual analysis start for review {review_id}")
        
        # Verify review belongs to user
        review_response = supabase_admin.table("tabular_reviews").select("id, status").eq("id", review_id).eq("user_id", current_user.id).execute()
        
        if not review_response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Review not found"
            )
        
        # Clear existing results if force reprocess
        if analysis_request and analysis_request.force_reprocess:
            supabase_admin.table("tabular_review_results").delete().eq("review_id", review_id).execute()
        
        # Update review status to processing
        supabase_admin.table("tabular_reviews").update({
            "status": "processing",
            "last_processed_at": datetime.utcnow().isoformat()
        }).eq("id", review_id).execute()
        
        # Start immediate analysis
        asyncio.create_task(process_review_analysis_realtime(review_id, str(current_user.id)))
        
        return {"message": "Analysis started", "review_id": review_id, "status": "processing"}
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to start analysis: {str(e)}"
        )

@router.get("/{review_id}/status", response_model=AnalysisStatus)
async def get_analysis_status(
    review_id: str,
    current_user = Depends(get_current_user)
):
    """Get the current status of an analysis"""
    try:
        supabase_admin = get_supabase_admin()
        
        # Get review
        review_response = supabase_admin.table("tabular_reviews").select("*").eq("id", review_id).eq("user_id", current_user.id).execute()
        
        if not review_response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Review not found"
            )
        
        review = review_response.data[0]
        
        # Get progress information
        files_count_response = supabase_admin.table("tabular_review_files").select("id", count="exact").eq("review_id", review_id).execute()
        columns_count_response = supabase_admin.table("tabular_review_columns").select("id", count="exact").eq("review_id", review_id).execute()
        results_count_response = supabase_admin.table("tabular_review_results").select("id", count="exact").eq("review_id", review_id).execute()
        
        total_files = files_count_response.count or 0
        total_columns = columns_count_response.count or 0
        total_cells = total_files * total_columns
        completed_cells = results_count_response.count or 0
        
        progress_percentage = (completed_cells / total_cells * 100) if total_cells > 0 else 0
        files_processed = completed_cells // total_columns if total_columns > 0 else 0
        
        return AnalysisStatus(
            review_id=review_id,
            status=review["status"],
            progress_percentage=progress_percentage,
            files_processed=files_processed,
            total_files=total_files,
            cells_completed=completed_cells,
            total_cells=total_cells,
            estimated_completion=None,  # Could implement based on processing speed
            error_message=None,
            current_task=f"Processing {files_processed}/{total_files} files" if review["status"] == "processing" else None
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get analysis status: {str(e)}"
        )

@router.put("/{review_id}/results/{result_id}")
async def update_result(
    review_id: str,
    result_id: str,
    request: TabularReviewResultUpdate,
    current_user = Depends(get_current_user)
):
    """Update a specific result (for manual corrections)"""
    try:
        supabase_admin = get_supabase_admin()
        
        # Verify review and result belong to user
        review_response = supabase_admin.table("tabular_reviews").select("id").eq("id", review_id).eq("user_id", current_user.id).execute()
        if not review_response.data:
            raise HTTPException(status_code=404, detail="Review not found")
        
        result_response = supabase_admin.table("tabular_review_results").select("*").eq("id", result_id).eq("review_id", review_id).execute()
        if not result_response.data:
            raise HTTPException(status_code=404, detail="Result not found")
        
        # Prepare update data
        update_data = {
            "updated_at": datetime.utcnow().isoformat()
        }
        
        if request.extracted_value is not None:
            update_data["extracted_value"] = request.extracted_value
        if request.confidence_score is not None:
            update_data["confidence_score"] = request.confidence_score
        if request.source_reference is not None:
            update_data["source_reference"] = request.source_reference
        
        # Update result
        update_response = supabase_admin.table("tabular_review_results").update(update_data).eq("id", result_id).execute()
        
        if hasattr(update_response, 'error') and update_response.error:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to update result: {update_response.error}"
            )
        
        # Send real-time update
        broadcast_to_user(str(current_user.id), {
            'type': 'result_updated',
            'review_id': review_id,
            'result_id': result_id,
            'message': 'Result updated successfully'
        })
        
        return update_response.data[0]
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update result: {str(e)}")

@router.get("/{review_id}/export")
async def export_review_data(
    review_id: str,
    format: ExportFormat = Query(ExportFormat.CSV),
    include_metadata: bool = Query(True),
    include_confidence: bool = Query(True),
    current_user = Depends(get_current_user)
):
    """Export review data in various formats"""
    try:
        supabase_admin = get_supabase_admin()
        
        # Verify review belongs to user
        review_response = supabase_admin.table("tabular_reviews").select("*").eq("id", review_id).eq("user_id", current_user.id).execute()
        if not review_response.data:
            raise HTTPException(status_code=404, detail="Review not found")
        
        review = review_response.data[0]
        
        # Get columns, files, and results
        columns_response = supabase_admin.table("tabular_review_columns").select("*").eq("review_id", review_id).order("column_order").execute()
        files_response = supabase_admin.table("tabular_review_files").select("*, files(original_filename)").eq("review_id", review_id).execute()
        results_response = supabase_admin.table("tabular_review_results").select("*").eq("review_id", review_id).execute()
        
        # Build results matrix
        results_dict = {}
        for result in results_response.data:
            key = (result["file_id"], result["column_id"])
            results_dict[key] = result
        
        if format == ExportFormat.CSV:
            # Create CSV
            output = io.StringIO()
            writer = csv.writer(output)
            
            # Header row
            header = ["Document"]
            for column in columns_response.data:
                header.append(column["column_name"])
                if include_confidence:
                    header.append(f"{column['column_name']}_confidence")
                if include_metadata:
                    header.append(f"{column['column_name']}_source")
            
            writer.writerow(header)
            
            # Data rows
            for file_data in files_response.data:
                row = [file_data["files"]["original_filename"]]
                
                for column in columns_response.data:
                    key = (file_data["file_id"], column["id"])
                    result = results_dict.get(key)
                    
                    # Value
                    row.append(result["extracted_value"] if result else "")
                    
                    # Confidence
                    if include_confidence:
                        row.append(result["confidence_score"] if result else "")
                    
                    # Source
                    if include_metadata:
                        row.append(result["source_reference"] if result else "")
                
                writer.writerow(row)
            
            output.seek(0)
            content = output.getvalue()
            
            return Response(
                content=content,
                media_type="text/csv",
                headers={"Content-Disposition": f"attachment; filename={review['name']}_export.csv"}
            )
        
        elif format == ExportFormat.JSON:
            # Create JSON structure
            export_data = {
                "review": {
                    "id": review["id"],
                    "name": review["name"],
                    "description": review.get("description"),
                    "created_at": review["created_at"],
                    "total_files": len(files_response.data),
                    "total_columns": len(columns_response.data)
                },
                "columns": [
                    {
                        "id": col["id"],
                        "name": col["column_name"],
                        "prompt": col["prompt"],
                        "data_type": col["data_type"],
                        "order": col["column_order"]
                    } for col in columns_response.data
                ],
                "data": []
            }
            
            for file_data in files_response.data:
                file_results = {
                    "file_id": file_data["file_id"],
                    "filename": file_data["files"]["original_filename"],
                    "results": {}
                }
                
                for column in columns_response.data:
                    key = (file_data["file_id"], column["id"])
                    result = results_dict.get(key)
                    
                    column_result = {
                        "value": result["extracted_value"] if result else None
                    }
                    
                    if include_confidence:
                        column_result["confidence"] = result["confidence_score"] if result else None
                    
                    if include_metadata:
                        column_result["source"] = result["source_reference"] if result else None
                    
                    file_results["results"][column["column_name"]] = column_result
                
                export_data["data"].append(file_results)
            
            return Response(
                content=json.dumps(export_data, indent=2),
                media_type="application/json",
                headers={"Content-Disposition": f"attachment; filename={review['name']}_export.json"}
            )
        
        else:
            raise HTTPException(status_code=400, detail="Unsupported export format")
            
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to export data: {str(e)}")

@router.get("/{review_id}/stats", response_model=ValidationStats)
async def get_review_stats(
    review_id: str,
    current_user = Depends(get_current_user)
):
    """Get validation and quality statistics for a review"""
    try:
        supabase_admin = get_supabase_admin()
        
        # Verify review belongs to user
        review_response = supabase_admin.table("tabular_reviews").select("id").eq("id", review_id).eq("user_id", current_user.id).execute()
        if not review_response.data:
            raise HTTPException(status_code=404, detail="Review not found")
        
        # Get all results for statistics
        results_response = supabase_admin.table("tabular_review_results").select("*").eq("review_id", review_id).execute()
        
        total_results = len(results_response.data)
        validated_results = 0  # No manual editing field in database
        invalid_results = 0    # No invalid field in database
        high_confidence_results = len([r for r in results_response.data if (r.get("confidence_score") or 0) > 0.8])
        low_confidence_results = len([r for r in results_response.data if (r.get("confidence_score") or 0) < 0.5])
        manually_edited_results = 0  # No manual editing field in database
        
        return ValidationStats(
            total_results=total_results,
            validated_results=validated_results,
            invalid_results=invalid_results,
            high_confidence_results=high_confidence_results,
            low_confidence_results=low_confidence_results,
            manually_edited_results=manually_edited_results
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get stats: {str(e)}")

@router.delete("/{review_id}")
async def delete_tabular_review(
    review_id: str,
    current_user = Depends(get_current_user)
):
    """Delete a tabular review"""
    try:
        supabase_admin = get_supabase_admin()
        
        # Verify review belongs to user
        review_response = supabase_admin.table("tabular_reviews").select("id").eq("id", review_id).eq("user_id", current_user.id).execute()
        
        if not review_response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Review not found"
            )
        
        # Delete review (cascading deletes will handle related records)
        supabase_admin.table("tabular_reviews").delete().eq("id", review_id).execute()
        
        # Clean up event buffer
        with buffer_lock:
            if review_id in event_buffer:
                del event_buffer[review_id]
                print(f"🗑️  Cleaned up event buffer for deleted review: {review_id}")
        
        return {"message": "Review deleted successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete review: {str(e)}"
        )

@router.get("/summary", response_model=ReviewSummary)
async def get_reviews_summary(
    current_user = Depends(get_current_user)
):
    """Get summary statistics for all user reviews"""
    try:
        supabase_admin = get_supabase_admin()
        
        # Get review counts by status
        reviews_response = supabase_admin.table("tabular_reviews").select("status").eq("user_id", current_user.id).execute()
        
        total_reviews = len(reviews_response.data)
        active_reviews = len([r for r in reviews_response.data if r["status"] == "processing"])
        completed_reviews = len([r for r in reviews_response.data if r["status"] == "completed"])
        failed_reviews = len([r for r in reviews_response.data if r["status"] == "failed"])
        
        # Get document and extraction counts
        files_response = supabase_admin.table("tabular_review_files").select("review_id").eq("review_id", "in.(SELECT id FROM tabular_reviews WHERE user_id = '{}')".format(current_user.id)).execute()
        results_response = supabase_admin.table("tabular_review_results").select("confidence_score").eq("review_id", "in.(SELECT id FROM tabular_reviews WHERE user_id = '{}')".format(current_user.id)).execute()
        
        total_documents_processed = len(files_response.data)
        total_extractions = len(results_response.data)
        
        # Calculate average confidence
        confidences = [r["confidence_score"] for r in results_response.data if r.get("confidence_score") is not None]
        average_confidence = sum(confidences) / len(confidences) if confidences else 0.0
        
        return ReviewSummary(
            total_reviews=total_reviews,
            active_reviews=active_reviews,
            completed_reviews=completed_reviews,
            failed_reviews=failed_reviews,
            total_documents_processed=total_documents_processed,
            total_extractions=total_extractions,
            average_confidence=average_confidence
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get summary: {str(e)}")

# ============================================================================
# BACKGROUND CLEANUP TASKS
# ============================================================================

async def cleanup_old_buffers():
    """Clean up event buffers for completed reviews"""
    while True:
        try:
            await asyncio.sleep(3600)  # Clean every hour
            
            with buffer_lock:
                # Remove buffers older than 2 hours for completed reviews
                current_time = time.time()
                reviews_to_remove = []
                
                for review_id, events in event_buffer.items():
                    if events and len(events) > 0:
                        latest_event = events[-1]
                        if (current_time - latest_event.get('server_timestamp', 0)) > 7200:  # 2 hours
                            # Check if review is completed
                            try:
                                supabase = get_supabase_admin()
                                review = supabase.table("tabular_reviews").select("status").eq("id", review_id).execute()
                                if review.data and review.data[0]["status"] in ["completed", "failed"]:
                                    reviews_to_remove.append(review_id)
                            except:
                                # If we can't check status, assume it's safe to remove old buffers
                                reviews_to_remove.append(review_id)
                
                for review_id in reviews_to_remove:
                    del event_buffer[review_id]
                    print(f"🧹 Cleaned up event buffer for old review: {review_id}")
                    
        except Exception as e:
            print(f"💥 Error in buffer cleanup: {e}")

# # Start the cleanup task when the app starts
# try:
#     asyncio.create_task(cleanup_old_buffers())
#     print("🧹 Started event buffer cleanup task")
# except:
#     pass  # Ignore if already running

async def _redis_listener():
    async for event in listen():        # ❶ blocks on Redis
        _fanout_local(event)            # ❷ deliver to this worker’s queues

# Automatically spun up when module is imported by Gunicorn/Uvicorn worker
# asyncio.create_task(_redis_listener())
# print("🔔 Redis Pub/Sub listener started")
