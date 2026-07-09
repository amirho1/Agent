import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { prisma } from "../db/prisma";
import { stringifyJson } from "../db/json";
import { getChatDetails } from "./service";

const uploadDir = join(process.cwd(), "uploads");

export async function storeChatUpload(chatId: string, file: File) {
  if (!isSupportedUpload(file)) {
    throw new Error("Only .txt and .md uploads are supported in this MVP.");
  }

  const chat = await prisma.chat.findUnique({ where: { id: chatId } });
  if (!chat) {
    throw new Error("Chat was not found.");
  }

  await mkdir(uploadDir, { recursive: true });
  const bytes = new Uint8Array(await file.arrayBuffer());
  const storedFileName = `${Date.now()}-${sanitizeFileName(file.name)}`;
  const path = join(uploadDir, storedFileName);
  await writeFile(path, bytes);

  const message = await prisma.message.create({
    data: {
      chatId,
      role: "user",
      content: `Uploaded ${file.name}`,
      metadataJson: stringifyJson({ upload: true }),
    },
  });

  await prisma.uploadedFile.create({
    data: {
      chatId,
      messageId: message.id,
      fileName: file.name,
      contentType: file.type || inferContentType(file.name),
      size: file.size,
      path,
    },
  });

  await prisma.message.create({
    data: {
      chatId,
      role: "assistant",
      content:
        "File uploaded. For this MVP, percentage price updates are prepared from live PMS rows; uploaded text can be kept with the chat for review context.",
    },
  });

  return getChatDetails(chatId);
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
