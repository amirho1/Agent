import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { prisma } from "../db/prisma";
import { logOperationEvent, withLoggedOperation } from "../logging";
import { processUploadedRateSheet } from "./service";

const uploadDir = join(process.cwd(), "uploads");

export async function storeChatUpload(chatId: string, file: File) {
  return withLoggedOperation(
    "file.upload",
    {
      chatId,
      fileName: file.name,
      contentType: file.type || inferContentType(file.name),
      size: file.size,
    },
    async () => {
      if (!isSupportedUpload(file)) {
        throw new Error("Only .txt and .md uploads are supported in this MVP.");
      }

      const chat = await prisma.chat.findUnique({ where: { id: chatId } });
      if (!chat) {
        throw new Error("Chat was not found.");
      }

      const text = await file.text();
      logOperationEvent("file.parsing", "file.text_extracted", {
        chatId,
        fileName: file.name,
        contentLength: text.length,
      });
      await mkdir(uploadDir, { recursive: true });
      const bytes = new Uint8Array(await file.arrayBuffer());
      const storedFileName = `${Date.now()}-${sanitizeFileName(file.name)}`;
      const path = join(uploadDir, storedFileName);
      await writeFile(path, bytes);
      logOperationEvent("file.upload", "file.stored", {
        chatId,
        fileName: file.name,
        storedFileName,
        path,
        size: file.size,
      });

      await prisma.uploadedFile.create({
        data: {
          chatId,
          fileName: file.name,
          contentType: file.type || inferContentType(file.name),
          size: file.size,
          path,
        },
      });
      logOperationEvent("file.upload", "file.upload_record.persisted", {
        chatId,
        fileName: file.name,
        contentType: file.type || inferContentType(file.name),
        size: file.size,
      });

      return processUploadedRateSheet(chatId, `Uploaded ${file.name}`, text, {
        upload: {
          fileName: file.name,
          contentType: file.type || inferContentType(file.name),
          size: file.size,
        },
      });
    },
  );
}

export function isSupportedUpload(file: Pick<File, "name">): boolean {
  const extension = file.name.toLowerCase().split(".").pop();
  return ["txt", "md", "markdown"].includes(extension ?? "");
}

function sanitizeFileName(fileName: string): string {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
}

function inferContentType(fileName: string): string {
  return fileName.toLowerCase().endsWith(".txt")
    ? "text/plain"
    : "text/markdown";
}
