package com.skillfuze.controller;

import java.security.Principal;
import java.util.UUID;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Controller;

import com.skillfuze.entity.ChatGroupMessage;
import com.skillfuze.entity.Message;
import com.skillfuze.service.ChatService;

import lombok.extern.slf4j.Slf4j;

@Controller
@Slf4j
public class ChatController {

    @Autowired
    private ChatService chatService;

    @Autowired
    private SimpMessagingTemplate messagingTemplate;

    @MessageMapping("/chat.sendDirect")
    public void sendDirectMessage(@Payload DirectMessagePayload payload, Principal principal) {
        if (principal == null || payload.getReceiverId() == null || payload.getText() == null) return;

        try {
            UUID senderId = UUID.fromString(principal.getName());
            UUID receiverId = payload.getReceiverId();

            Message msg = chatService.saveDirectMessage(senderId, receiverId, payload.getText());

            messagingTemplate.convertAndSendToUser(receiverId.toString(), "/queue/messages", msg);
            messagingTemplate.convertAndSendToUser(senderId.toString(), "/queue/messages", msg);

        } catch (Exception e) {
            log.error("Error sending direct message via STOMP", e);
        }
    }

    @MessageMapping("/chat.sendGroup")
    public void sendGroupMessage(@Payload GroupMessagePayload payload, Principal principal) {
        if (principal == null || payload.getGroupId() == null || payload.getText() == null) return;

        try {
            UUID senderId = UUID.fromString(principal.getName());
            UUID groupId = payload.getGroupId();

            ChatGroupMessage msg = chatService.saveGroupMessage(senderId, groupId, payload.getText());

            messagingTemplate.convertAndSend("/topic/groups/" + groupId, msg);

        } catch (Exception e) {
            log.error("Error sending group message via STOMP", e);
        }
    }

    public static class DirectMessagePayload {
        private UUID receiverId;
        private String text;

        public UUID getReceiverId() { return receiverId; }
        public void setReceiverId(UUID receiverId) { this.receiverId = receiverId; }
        public String getText() { return text; }
        public void setText(String text) { this.text = text; }
    }

    public static class GroupMessagePayload {
        private UUID groupId;
        private String text;

        public UUID getGroupId() { return groupId; }
        public void setGroupId(UUID groupId) { this.groupId = groupId; }
        public String getText() { return text; }
        public void setText(String text) { this.text = text; }
    }
}
