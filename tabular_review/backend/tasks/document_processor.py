from celery import Celery
from docling.document_converter import DocumentConverter
from docling.datamodel.base_models import InputFormat
from docling.datamodel.pipeline_options import PdfPipelineOptions
from docling.document_converter import PdfFormatOption
from docling.datamodel.accelerator_options import AcceleratorOptions, AcceleratorDevice
from datetime import datetime
from core.supabase_create import get_supabase_admin
from celery_app import celery_app
import tempfile
import os

@celery_app.task
def process_document_task(file_id: str):
    try:
        # Get file record using service key
        file_response = get_supabase_admin().table("files").select("*").eq("id", file_id).execute()

        if hasattr(file_response, 'error') and file_response.error:
            return {"status": "error", "message": "File not found"}

        if not file_response.data:
            return {"status": "error", "message": "File not found"}

        file_record = file_response.data[0]

        # Update status to processing
        get_supabase_admin().table("files").update({
            "status": "processing",
            "updated_at": datetime.utcnow().isoformat()
        }).eq("id", file_id).execute()

        # Download file from Supabase Storage using service key
        download_response = get_supabase_admin().storage.from_("documents").download(file_record["storage_path"])

        if not download_response:
            get_supabase_admin().table("files").update({
                "status": "failed",
                "error_message": "Failed to download file from storage",
                "updated_at": datetime.utcnow().isoformat()
            }).eq("id", file_id).execute()
            return {"status": "error", "message": "Failed to download file"}

        # Process with Docling
        with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as temp_file:
            temp_file.write(download_response)
            temp_file.flush()

            try:
                # Configure Docling to use CPU (no MPS)
                accelerator_opts = AcceleratorOptions(
                    num_threads=8,
                    device=AcceleratorDevice.CPU
                )
                pdf_opts = PdfPipelineOptions()
                pdf_opts.accelerator_options = accelerator_opts

                converter = DocumentConverter(
                    format_options={
                        InputFormat.PDF: PdfFormatOption(pipeline_options=pdf_opts)
                    }
                )
                result = converter.convert(temp_file.name)
                markdown_content = result.document.export_to_markdown()

                # Save markdown content using service key
                word_count = len(markdown_content.split())
                markdown_data = {
                    "file_id": file_id,
                    "user_id": file_record["user_id"],
                    "content": markdown_content,
                    "word_count": word_count,
                    "created_at": datetime.utcnow().isoformat(),
                    "updated_at": datetime.utcnow().isoformat()
                }

                get_supabase_admin().table("markdown_content").insert(markdown_data).execute()

                # Update file status to completed
                get_supabase_admin().table("files").update({
                    "status": "completed",
                    "processed_at": datetime.utcnow().isoformat(),
                    "updated_at": datetime.utcnow().isoformat()
                }).eq("id", file_id).execute()

                return {"status": "success", "word_count": word_count}

            except Exception as e:
                get_supabase_admin().table("files").update({
                    "status": "failed",
                    "error_message": str(e),
                    "updated_at": datetime.utcnow().isoformat()
                }).eq("id", file_id).execute()
                return {"status": "error", "message": str(e)}

            finally:
                os.unlink(temp_file.name)

    except Exception as e:
        # Update file status to failed if it exists
        try:
            get_supabase_admin().table("files").update({
                "status": "failed",
                "error_message": str(e),
                "updated_at": datetime.utcnow().isoformat()
            }).eq("id", file_id).execute()
        except:
            pass
        return {"status": "error", "message": str(e)}
