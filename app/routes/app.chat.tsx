// Resource route for the live chat in the Help panel (components/SupportWidget). Live chat is part of the
// Growth and Premium plans (and the trial); other plans get `allowed: false` and can't post.
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { getPlan } from "../models/billing.server";
import { agentOnline, getThread, markRead, postMessage, unreadForMerchant, type ChatMessageView } from "../models/chat.server";

export type ChatLoaderData = { allowed: boolean; messages: ChatMessageView[]; unread: number; online: boolean };
export type ChatActionData = { message?: ChatMessageView; error?: string };

const LOCKED: ChatLoaderData = { allowed: false, messages: [], unread: 0, online: false };

// ?since=<iso> returns only newer messages; ?read=1 marks support replies as read (chat is on screen).
export const loader = async ({ request }: LoaderFunctionArgs): Promise<ChatLoaderData> => {
  const { session, billing } = await authenticate.admin(request);
  const url = new URL(request.url);
  try {
    const plan = await getPlan(billing, session.shop);
    if (!plan.features.liveChat) return LOCKED;
    if (url.searchParams.get("read") === "1") await markRead(session.shop, "merchant");
    const [messages, unread, online] = await Promise.all([
      getThread(session.shop, url.searchParams.get("since")),
      unreadForMerchant(session.shop),
      agentOnline(),
    ]);
    return { allowed: true, messages, unread, online };
  } catch (e) {
    console.error("Live chat load failed", e);
    return { allowed: true, messages: [], unread: 0, online: false };
  }
};

export const action = async ({ request }: ActionFunctionArgs): Promise<ChatActionData> => {
  const { session, billing } = await authenticate.admin(request);
  const form = await request.formData();
  try {
    const plan = await getPlan(billing, session.shop);
    if (!plan.features.liveChat) return { error: "Live chat is part of the Growth and Premium plans." };
    return await postMessage(session.shop, "merchant", form.get("body"));
  } catch (e) {
    console.error("Live chat send failed", e);
    return { error: "Message not sent. Please try again." };
  }
};
