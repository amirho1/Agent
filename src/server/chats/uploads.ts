import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { prisma } from "../db/prisma";
import { processUploadedRateSheet } from "./service";

const uploadDir = join(process.cwd(), "uploads");

export async function storeChatUpload(chatId: string, file: File) {
  if (!isSupportedUpload(file)) {
    throw new Error("Only .txt and .md uploads are supported in this MVP.");
  }

  const chat = await prisma.chat.findUnique({ where: { id: chatId } });
  if (!chat) {
    throw new Error("Chat was not found.");
  }

  const text = await file.text();
  await mkdir(uploadDir, { recursive: true });
  const bytes = new Uint8Array(await file.arrayBuffer());
  const storedFileName = `${Date.now()}-${sanitizeFileName(file.name)}`;
  const path = join(uploadDir, storedFileName);
  await writeFile(path, bytes);

  await prisma.uploadedFile.create({
    data: {
      chatId,
      fileName: file.name,
      contentType: file.type || inferContentType(file.name),
      size: file.size,
      path,
    },
  });

  return processUploadedRateSheet(chatId, `Uploaded ${file.name}`, text, {
    upload: {
      fileName: file.name,
      contentType: file.type || inferContentType(file.name),
      size: file.size,
    },
  });
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
