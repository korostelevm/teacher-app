"use client";

import { UploadCloud, Send, X } from "lucide-react";
import { useState, useRef, useCallback } from "react";
import { cn } from "@/lib/utils";

/**
 * Props interface for the ChatInput component
 * @interface ChatInputProps
 */
interface ChatInputProps {
  /**
   * Callback function triggered when a message is sent
   * @param content The text content of the message
   * @param files Optional array of files to be sent with the message
   */
  onSendMessage: (content: string, files?: File[]) => void;

  /**
   * Flag indicating if files are currently being uploaded
   * @default false
   */
  isUploading?: boolean;

  /**
   * Flag indicating if a message is currently being processed
   * @default false 
   */
  isLoading?: boolean;
}

/**
 * ChatInput component that provides a text input area with file upload capabilities
 * for sending messages in a chat interface.
 * 
 * @component
 * @param {Object} props - Component props
 * @param {function} props.onSendMessage - Callback function triggered when a message is sent
 * @param {boolean} [props.isUploading=false] - Flag indicating if files are being uploaded
 * @param {boolean} [props.isLoading=false] - Flag indicating if a message is being processed
 * @returns {JSX.Element} A chat input interface with text area and file upload controls
 */
export function ChatInput({
  onSendMessage,
  isUploading,
  isLoading,
}: ChatInputProps) {
  const [content, setContent] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textAreaRef = useRef<HTMLInputElement>(null);

  /**
   * Handles the message submission process.
   * Validates that either text content or files exist before sending
   * to prevent empty messages from being sent.
   * Clears both content and files after successful submission to reset the form.
   */
  const handleSend = useCallback(() => {
    if (content.trim() || files.length > 0) {
      onSendMessage(content, files);
      setContent("");
      setFiles([]);
    }
  }, [content, files, onSendMessage]);

  /**
   * Processes file input changes by converting FileList to Array
   * and appending to existing files. Uses spread operator to maintain
   * immutability while updating state.
   * 
   * Note: FileList is converted to Array to make it easier to manage
   * and manipulate the files later (e.g., for removal).
   */
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFiles((prev) => [...prev, ...Array.from(e.target.files || [])]);
    }
  };

  /**
   * Removes a file from the files array by its index.
   * Uses filter instead of splice to maintain immutability
   * and trigger proper re-renders.
   * 
   * @param index - The position of the file to remove
   */
  const removeFile = (index: number) => {
    setFiles(files.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-4">
      {files.length > 0 && (
        <div className="flex flex-wrap gap-2 p-2 bg-muted rounded-lg">
          {files.map((file, index) => (
            <div
              key={index.toString()}
              className="relative flex items-center gap-2 bg-background p-2 rounded-md group"
            >
              <span className="text-sm truncate max-w-[200px]">
                {file.name}
              </span>
              <button
                className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center hover:bg-muted rounded"
                onClick={() => removeFile(index)}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <input
          type="file"
          multiple
          className="hidden"
          ref={fileInputRef}
          onChange={handleFileChange}
          accept="image/*,.pdf,.doc,.docx,.txt,.csv"
          data-testid="file-input"
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading || isLoading}
          className="flex items-center justify-center w-10 h-10 rounded-md border border-input bg-transparent hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <UploadCloud className="h-5 w-5" />
        </button>
        <input
          ref={textAreaRef}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Type your message..."
          className="flex-1 h-10 px-3 py-2 rounded-md border border-input bg-transparent resize-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={isLoading}
          autoFocus
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSend();
              textAreaRef.current?.focus();
            }
          }}
        />
        <button
          onClick={handleSend}
          disabled={
            (!content.trim() && files.length === 0) || isLoading || isUploading
          }
          className="flex items-center justify-center w-10 h-10 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Send className={cn("h-5 w-5", isLoading && "animate-spin")} />
        </button>
      </div>
    </div>
  );
}
