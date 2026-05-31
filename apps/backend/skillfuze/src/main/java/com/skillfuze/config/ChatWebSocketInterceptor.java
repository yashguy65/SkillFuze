package com.skillfuze.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.JsonNode;
import java.util.Base64;
import java.util.UUID;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Lazy;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.ChannelInterceptor;
import org.springframework.messaging.support.MessageHeaderAccessor;
import org.springframework.stereotype.Component;

import com.skillfuze.service.PresenceService;

import lombok.extern.slf4j.Slf4j;

@Component
@Slf4j
public class ChatWebSocketInterceptor implements ChannelInterceptor {

    private static final ObjectMapper objectMapper = new ObjectMapper();

    @Autowired
    @Lazy
    private PresenceService presenceService;

    @Override
    public Message<?> preSend(Message<?> message, MessageChannel channel) {
        StompHeaderAccessor accessor = MessageHeaderAccessor.getAccessor(message, StompHeaderAccessor.class);
        if (accessor != null) {
            if (StompCommand.CONNECT.equals(accessor.getCommand())) {
                String authHeader = accessor.getFirstNativeHeader("Authorization");
                String token = null;
                if (authHeader != null && authHeader.startsWith("Bearer ")) {
                    token = authHeader.substring(7);
                } else {
                    token = accessor.getFirstNativeHeader("token");
                }

                if (token != null) {
                    try {
                        String userIdStr = getSubjectFromToken(token);
                        if (userIdStr != null) {
                            UUID userId = UUID.fromString(userIdStr);
                            accessor.setUser(new StompPrincipal(userId.toString()));
                            presenceService.markOnline(userId);
                            log.info("WebSocket Authenticated user: {}", userId);
                        }
                    } catch (Exception e) {
                        log.error("WebSocket Authentication error", e);
                    }
                }
            } else if (StompCommand.DISCONNECT.equals(accessor.getCommand())) {
                java.security.Principal principal = accessor.getUser();
                if (principal != null) {
                    try {
                        UUID userId = UUID.fromString(principal.getName());
                        presenceService.markOffline(userId);
                    } catch (Exception e) {
                        log.error("Error marking user offline", e);
                    }
                }
            }
        }
        return message;
    }

    private String getSubjectFromToken(String token) {
        try {
            String[] parts = token.split("\\.");
            if (parts.length < 2) return null;
            byte[] decodedBytes;
            try {
                decodedBytes = Base64.getUrlDecoder().decode(parts[1]);
            } catch (IllegalArgumentException e) {
                decodedBytes = Base64.getDecoder().decode(parts[1]);
            }
            JsonNode payloadNode = objectMapper.readTree(decodedBytes);
            if (payloadNode.has("sub")) {
                return payloadNode.get("sub").asText();
            }
        } catch (Exception e) {
            log.error("Failed to parse token payload", e);
        }
        return null;
    }

    public static class StompPrincipal implements java.security.Principal {
        private final String name;

        public StompPrincipal(String name) {
            this.name = name;
        }

        @Override
        public String getName() {
            return name;
        }
    }
}
