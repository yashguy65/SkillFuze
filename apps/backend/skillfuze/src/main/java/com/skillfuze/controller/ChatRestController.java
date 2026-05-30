package com.skillfuze.controller;

import java.security.Principal;
import java.util.List;
import java.util.Set;
import java.util.UUID;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.skillfuze.dto.ChatThreadSummary;
import com.skillfuze.entity.ChatGroup;
import com.skillfuze.entity.ChatGroupMessage;
import com.skillfuze.entity.Message;
import com.skillfuze.service.ChatService;
import com.skillfuze.service.PresenceService;

import lombok.extern.slf4j.Slf4j;

@RestController
@RequestMapping("/api/chat")
@Slf4j
public class ChatRestController {

    @Autowired
    private ChatService chatService;

    @Autowired
    private PresenceService presenceService;

    private UUID getUserId(Principal principal) {
        if (principal == null) {
            throw new SecurityException("Unauthorized: No active session principal");
        }
        return UUID.fromString(principal.getName());
    }

    @GetMapping("/threads")
    public ResponseEntity<?> getThreads(Principal principal) {
        try {
            UUID userId = getUserId(principal);
            List<ChatThreadSummary> threads = chatService.getChatThreads(userId);
            return ResponseEntity.ok(threads);
        } catch (SecurityException se) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(se.getMessage());
        } catch (Exception e) {
            log.error("Failed to load threads", e);
            return ResponseEntity.internalServerError().body(e.getMessage());
        }
    }

    @GetMapping("/history/direct")
    public ResponseEntity<?> getDirectHistory(@RequestParam("receiverId") UUID receiverId, Principal principal) {
        try {
            UUID userId = getUserId(principal);
            List<Message> history = chatService.getDirectHistory(userId, receiverId);
            return ResponseEntity.ok(history);
        } catch (SecurityException se) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(se.getMessage());
        } catch (Exception e) {
            log.error("Failed to load direct history", e);
            return ResponseEntity.internalServerError().body(e.getMessage());
        }
    }

    @GetMapping("/history/group")
    public ResponseEntity<?> getGroupHistory(@RequestParam("groupId") UUID groupId, Principal principal) {
        try {
            getUserId(principal);
            List<ChatGroupMessage> history = chatService.getGroupHistory(groupId);
            return ResponseEntity.ok(history);
        } catch (SecurityException se) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(se.getMessage());
        } catch (Exception e) {
            log.error("Failed to load group history", e);
            return ResponseEntity.internalServerError().body(e.getMessage());
        }
    }

    @PostMapping("/groups/create")
    public ResponseEntity<?> createGroup(@RequestBody CreateGroupRequest request, Principal principal) {
        try {
            UUID ownerId = getUserId(principal);
            ChatGroup group = chatService.createGroup(request.getName(), ownerId, request.getMemberIds());
            return ResponseEntity.ok(group);
        } catch (SecurityException se) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(se.getMessage());
        } catch (Exception e) {
            log.error("Failed to create group", e);
            return ResponseEntity.internalServerError().body(e.getMessage());
        }
    }

    @PostMapping("/groups/read")
    public ResponseEntity<?> markGroupRead(@RequestBody GroupIdPayload payload, Principal principal) {
        try {
            UUID userId = getUserId(principal);
            chatService.markGroupAsRead(payload.getGroupId(), userId);
            return ResponseEntity.ok().build();
        } catch (SecurityException se) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(se.getMessage());
        } catch (Exception e) {
            log.error("Failed to mark group read", e);
            return ResponseEntity.internalServerError().body(e.getMessage());
        }
    }

    @PostMapping("/messages/read")
    public ResponseEntity<?> markDirectMessagesRead(@RequestBody SenderIdPayload payload, Principal principal) {
        try {
            UUID userId = getUserId(principal);
            chatService.markDirectMessagesAsRead(userId, payload.getSenderId());
            return ResponseEntity.ok().build();
        } catch (SecurityException se) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(se.getMessage());
        } catch (Exception e) {
            log.error("Failed to mark direct read", e);
            return ResponseEntity.internalServerError().body(e.getMessage());
        }
    }

    @PostMapping("/groups/transfer-owner")
    public ResponseEntity<?> transferGroupOwnership(@RequestBody TransferOwnershipRequest request, Principal principal) {
        try {
            UUID ownerId = getUserId(principal);
            chatService.transferGroupOwnership(request.getGroupId(), ownerId, request.getNewOwnerId());
            return ResponseEntity.ok().build();
        } catch (SecurityException se) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(se.getMessage());
        } catch (Exception e) {
            log.error("Failed to transfer group ownership", e);
            return ResponseEntity.internalServerError().body(e.getMessage());
        }
    }

    @DeleteMapping("/groups/{groupId}")
    public ResponseEntity<?> deleteGroup(@PathVariable("groupId") UUID groupId, Principal principal) {
        try {
            UUID ownerId = getUserId(principal);
            chatService.deleteGroup(groupId, ownerId);
            return ResponseEntity.ok().build();
        } catch (SecurityException se) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(se.getMessage());
        } catch (Exception e) {
            log.error("Failed to delete group", e);
            return ResponseEntity.internalServerError().body(e.getMessage());
        }
    }

    @GetMapping("/presence/online")
    public ResponseEntity<?> getOnlineUsers(Principal principal) {
        try {
            getUserId(principal);
            Set<UUID> online = presenceService.getOnlineUsers();
            return ResponseEntity.ok(online);
        } catch (SecurityException se) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(se.getMessage());
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(e.getMessage());
        }
    }

    public static class CreateGroupRequest {
        private String name;
        private List<UUID> memberIds;

        public String getName() { return name; }
        public void setName(String name) { this.name = name; }
        public List<UUID> getMemberIds() { return memberIds; }
        public void setMemberIds(List<UUID> memberIds) { this.memberIds = memberIds; }
    }

    public static class GroupIdPayload {
        private UUID groupId;

        public UUID getGroupId() { return groupId; }
        public void setGroupId(UUID groupId) { this.groupId = groupId; }
    }

    public static class SenderIdPayload {
        private UUID senderId;

        public UUID getSenderId() { return senderId; }
        public void setSenderId(UUID senderId) { this.senderId = senderId; }
    }

    public static class TransferOwnershipRequest {
        private UUID groupId;
        private UUID newOwnerId;

        public UUID getGroupId() { return groupId; }
        public void setGroupId(UUID groupId) { this.groupId = groupId; }
        public UUID getNewOwnerId() { return newOwnerId; }
        public void setNewOwnerId(UUID newOwnerId) { this.newOwnerId = newOwnerId; }
    }
}
