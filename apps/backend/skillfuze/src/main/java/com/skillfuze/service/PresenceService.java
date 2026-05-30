package com.skillfuze.service;

import java.util.Collections;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Lazy;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

import lombok.extern.slf4j.Slf4j;

@Service
@Slf4j
public class PresenceService {

    private final Set<UUID> onlineUsers = Collections.newSetFromMap(new ConcurrentHashMap<>());

    @Autowired
    @Lazy
    private SimpMessagingTemplate messagingTemplate;

    public void markOnline(UUID userId) {
        if (userId == null) return;
        onlineUsers.add(userId);
        log.info("User {} connected/online", userId);
        broadcastPresenceEvent(userId, "online");
    }

    public void markOffline(UUID userId) {
        if (userId == null) return;
        if (onlineUsers.remove(userId)) {
            log.info("User {} disconnected/offline", userId);
            broadcastPresenceEvent(userId, "offline");
        }
    }

    public Set<UUID> getOnlineUsers() {
        return Collections.unmodifiableSet(onlineUsers);
    }

    public boolean isOnline(UUID userId) {
        return onlineUsers.contains(userId);
    }

    private void broadcastPresenceEvent(UUID userId, String status) {
        try {
            PresenceEvent event = new PresenceEvent(userId, status);
            messagingTemplate.convertAndSend("/topic/presence", event);
        } catch (Exception e) {
            log.error("Failed to broadcast presence event", e);
        }
    }

    public static class PresenceEvent {
        private UUID userId;
        private String status;

        public PresenceEvent(UUID userId, String status) {
            this.userId = userId;
            this.status = status;
        }

        public UUID getUserId() { return userId; }
        public String getStatus() { return status; }
    }
}
