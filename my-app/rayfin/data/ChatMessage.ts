import { entity, uuid, text, date } from "@microsoft/rayfin-core";

@entity()
export class ChatMessage {
  @uuid()
  id!: string;

  @text()
  session_id!: string;

  @text()
  role!: string;

  @text()
  content!: string;

  @date()
  timestamp!: Date;
}
