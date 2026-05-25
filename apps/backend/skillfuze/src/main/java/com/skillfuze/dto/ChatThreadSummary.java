package com.skillfuze.dto;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ChatThreadSummary {
    private String id; // "direct_userId" or "group_groupId"
    private String kind; // "direct" or "group"
    private UUID userId; // for direct
    private UUID groupId; // for group
    private String name;
    private String avatar;
    private String lastMessage;
    private Instant lastMessageTime;
    private Instant lastActivityAt;
    private long unreadCount;
    private boolean online;
    private List<UUID> memberIds;
    private List<String> memberNames;
    private Instant lastReadAt;
    private boolean isOwner;
    private UUID ownerId;
}
