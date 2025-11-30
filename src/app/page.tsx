import { NextRequest } from "next/server";
import { headers } from "next/headers";
import ChatClient from "@/components/chat/chat-client";

export default function Home() {
  // This will be a server component
  return <ChatClient />;
}
