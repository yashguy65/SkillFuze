package com.skillfuze.service;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.skillfuze.dto.ChatThreadSummary;
import com.skillfuze.entity.ChatGroup;
import com.skillfuze.entity.ChatGroupMember;
import com.skillfuze.entity.ChatGroupMessage;
import com.skillfuze.entity.Message;
import com.skillfuze.repository.ChatGroupMemberRepository;
import com.skillfuze.repository.ChatGroupMessageRepository;
import com.skillfuze.repository.ChatGroupRepository;
import com.skillfuze.repository.MessageRepository;

@Service
@Transactional
public class ChatService {

    @Autowired
    private MessageRepository messageRepository;

    @Autowired
    private ChatGroupRepository chatGroupRepository;

    @Autowired
    private ChatGroupMemberRepository chatGroupMemberRepository;

    @Autowired
    private ChatGroupMessageRepository chatGroupMessageRepository;

    @Autowired
    private PresenceService presenceService;

    // --- Direct Messages ---
    public List<Message> getDirectHistory(UUID u1, UUID u2) {
        return messageRepository.findDirectChatHistory(u1, u2);
    }

    public Message saveDirectMessage(UUID senderId, UUID receiverId, String text) {
        Message message = Message.builder()
                .senderId(senderId)
                .receiverId(receiverId)
                .text(text)
                .status("sent")
                .createdAt(Instant.now())
                .build();
        return messageRepository.save(message);
    }

    public void markDirectMessagesAsRead(UUID receiverId, UUID senderId) {
        messageRepository.markDirectMessagesAsRead(receiverId, senderId);
    }

    // --- Group Chats ---
    public List<ChatGroupMessage> getGroupHistory(UUID groupId) {
        return chatGroupMessageRepository.findByGroupIdOrderByCreatedAtAsc(groupId);
    }

    public ChatGroupMessage saveGroupMessage(UUID senderId, UUID groupId, String text) {
        if (!chatGroupMemberRepository.existsByGroupIdAndUserId(groupId, senderId)) {
            throw new IllegalArgumentException("User is not a member of this chat group");
        }

        ChatGroupMessage msg = ChatGroupMessage.builder()
                .groupId(groupId)
                .senderId(senderId)
                .text(text)
                .createdAt(Instant.now())
                .build();

        ChatGroupMessage saved = chatGroupMessageRepository.save(msg);

        chatGroupRepository.findById(groupId).ifPresent(group -> {
            group.setUpdatedAt(Instant.now());
            chatGroupRepository.save(group);
        });

        return saved;
    }

    public ChatGroup createGroup(String name, UUID ownerId, List<UUID> memberIds) {
        ChatGroup group = ChatGroup.builder()
                .name(name)
                .createdBy(ownerId)
                .createdAt(Instant.now())
                .updatedAt(Instant.now())
                .build();
        ChatGroup savedGroup = chatGroupRepository.save(group);

        ChatGroupMember ownerMember = ChatGroupMember.builder()
                .groupId(savedGroup.getId())
                .userId(ownerId)
                .role("owner")
                .joinedAt(Instant.now())
                .lastReadAt(Instant.now())
                .build();
        chatGroupMemberRepository.save(ownerMember);

        if (memberIds != null) {
            for (UUID memberId : memberIds) {
                if (!memberId.equals(ownerId)) {
                    ChatGroupMember member = ChatGroupMember.builder()
                            .groupId(savedGroup.getId())
                            .userId(memberId)
                            .role("member")
                            .joinedAt(Instant.now())
                            .build();
                    chatGroupMemberRepository.save(member);
                }
            }
        }

        return savedGroup;
    }

    public void markGroupAsRead(UUID groupId, UUID userId) {
        chatGroupMemberRepository.findByGroupIdAndUserId(groupId, userId).ifPresent(member -> {
            member.setLastReadAt(Instant.now());
            chatGroupMemberRepository.save(member);
        });
    }

    public void transferGroupOwnership(UUID groupId, UUID currentOwnerId, UUID newOwnerId) {
        ChatGroup group = chatGroupRepository.findById(groupId)
                .orElseThrow(() -> new IllegalArgumentException("Group not found"));

        if (!group.getCreatedBy().equals(currentOwnerId)) {
            throw new IllegalStateException("Unauthorized: Only the group owner can transfer ownership");
        }

        ChatGroupMember newOwnerMember = chatGroupMemberRepository.findByGroupIdAndUserId(groupId, newOwnerId)
                .orElseThrow(() -> new IllegalArgumentException("New owner must be a member of the group"));

        if (currentOwnerId.equals(newOwnerId)) return;

        newOwnerMember.setRole("owner");
        chatGroupMemberRepository.save(newOwnerMember);

        chatGroupMemberRepository.findByGroupIdAndUserId(groupId, currentOwnerId).ifPresent(oldOwner -> {
            oldOwner.setRole("member");
            chatGroupMemberRepository.save(oldOwner);
        });

        group.setCreatedBy(newOwnerId);
        chatGroupRepository.save(group);
    }

    public void deleteGroup(UUID groupId, UUID ownerId) {
        ChatGroup group = chatGroupRepository.findById(groupId)
                .orElseThrow(() -> new IllegalArgumentException("Group not found"));

        if (!group.getCreatedBy().equals(ownerId)) {
            throw new IllegalStateException("Unauthorized: Only the group owner can delete the group");
        }

        chatGroupRepository.delete(group);
    }

    public void addMembers(UUID groupId, UUID adminId, List<UUID> memberIds) {
        ChatGroupMember adminMember = chatGroupMemberRepository.findByGroupIdAndUserId(groupId, adminId)
                .orElseThrow(() -> new IllegalArgumentException("User is not a member of the group"));
        if (!"owner".equals(adminMember.getRole())) {
            throw new IllegalStateException("Unauthorized: Only admins can add members");
        }

        for (UUID memberId : memberIds) {
            if (!chatGroupMemberRepository.existsByGroupIdAndUserId(groupId, memberId)) {
                ChatGroupMember newMember = ChatGroupMember.builder()
                        .groupId(groupId)
                        .userId(memberId)
                        .role("member")
                        .joinedAt(Instant.now())
                        .build();
                chatGroupMemberRepository.save(newMember);
            }
        }

        chatGroupRepository.findById(groupId).ifPresent(group -> {
            group.setUpdatedAt(Instant.now());
            chatGroupRepository.save(group);
        });
    }

    public void kickMember(UUID groupId, UUID adminId, UUID memberId) {
        ChatGroupMember adminMember = chatGroupMemberRepository.findByGroupIdAndUserId(groupId, adminId)
                .orElseThrow(() -> new IllegalArgumentException("User is not a member of the group"));
        if (!"owner".equals(adminMember.getRole())) {
            throw new IllegalStateException("Unauthorized: Only admins can kick members");
        }

        ChatGroupMember targetMember = chatGroupMemberRepository.findByGroupIdAndUserId(groupId, memberId)
                .orElseThrow(() -> new IllegalArgumentException("Target user is not a member of the group"));

        if ("owner".equals(targetMember.getRole())) {
            throw new IllegalStateException("Cannot kick another admin");
        }

        chatGroupMemberRepository.delete(targetMember);

        chatGroupRepository.findById(groupId).ifPresent(group -> {
            group.setUpdatedAt(Instant.now());
            chatGroupRepository.save(group);
        });
    }

    public void makeAdmin(UUID groupId, UUID adminId, UUID targetMemberId) {
        ChatGroupMember adminMember = chatGroupMemberRepository.findByGroupIdAndUserId(groupId, adminId)
                .orElseThrow(() -> new IllegalArgumentException("User is not a member of the group"));
        if (!"owner".equals(adminMember.getRole())) {
            throw new IllegalStateException("Unauthorized: Only admins can promote other members");
        }

        ChatGroupMember targetMember = chatGroupMemberRepository.findByGroupIdAndUserId(groupId, targetMemberId)
                .orElseThrow(() -> new IllegalArgumentException("Target user is not a member of the group"));

        targetMember.setRole("owner");
        chatGroupMemberRepository.save(targetMember);
    }

    public void resignAdmin(UUID groupId, UUID userId) {
        ChatGroupMember membership = chatGroupMemberRepository.findByGroupIdAndUserId(groupId, userId)
                .orElseThrow(() -> new IllegalArgumentException("User is not a member of the group"));

        if (!"owner".equals(membership.getRole())) {
            throw new IllegalStateException("User is not an admin");
        }

        List<ChatGroupMember> allMembers = chatGroupMemberRepository.findByGroupId(groupId);
        long adminCount = allMembers.stream().filter(m -> "owner".equals(m.getRole())).count();

        if (adminCount == 1 && allMembers.size() > 1) {
            throw new IllegalStateException("You are the last admin. Please promote another member to admin before resigning.");
        }

        membership.setRole("member");
        chatGroupMemberRepository.save(membership);
    }

    public void leaveGroup(UUID groupId, UUID userId) {
        ChatGroupMember membership = chatGroupMemberRepository.findByGroupIdAndUserId(groupId, userId)
                .orElseThrow(() -> new IllegalArgumentException("User is not a member of the group"));

        List<ChatGroupMember> allMembers = chatGroupMemberRepository.findByGroupId(groupId);

        if ("owner".equals(membership.getRole())) {
            long adminCount = allMembers.stream().filter(m -> "owner".equals(m.getRole())).count();
            if (adminCount == 1 && allMembers.size() > 1) {
                throw new IllegalStateException("You are the last admin. Please promote another member to admin before leaving.");
            }
        }

        chatGroupMemberRepository.delete(membership);

        if (allMembers.size() <= 1) {
            chatGroupRepository.deleteById(groupId);
        } else {
            chatGroupRepository.findById(groupId).ifPresent(group -> {
                if (group.getCreatedBy().equals(userId)) {
                    UUID newCreator = allMembers.stream()
                            .filter(m -> !m.getUserId().equals(userId))
                            .map(ChatGroupMember::getUserId)
                            .findFirst().orElse(null);
                    if (newCreator != null) {
                        group.setCreatedBy(newCreator);
                    }
                }
                group.setUpdatedAt(Instant.now());
                chatGroupRepository.save(group);
            });
        }
    }

    // --- Active Chat Thread Summary Compilation ---
    public List<ChatThreadSummary> getChatThreads(UUID userId) {
        List<ChatThreadSummary> threads = new ArrayList<>();

        List<Message> allDirect = messageRepository.findAll().stream()
                .filter(m -> m.getSenderId().equals(userId) || m.getReceiverId().equals(userId))
                .collect(Collectors.toList());

        Map<UUID, List<Message>> directByPartner = new HashMap<>();
        for (Message msg : allDirect) {
            UUID partnerId = msg.getSenderId().equals(userId) ? msg.getReceiverId() : msg.getSenderId();
            directByPartner.computeIfAbsent(partnerId, k -> new ArrayList<>()).add(msg);
        }

        for (Map.Entry<UUID, List<Message>> entry : directByPartner.entrySet()) {
            UUID partnerId = entry.getKey();
            List<Message> msgs = entry.getValue();
            msgs.sort(Comparator.comparing(Message::getCreatedAt));
            Message latest = msgs.get(msgs.size() - 1);

            long unreadCount = msgs.stream()
                    .filter(m -> m.getReceiverId().equals(userId) && (m.getStatus() == null || !m.getStatus().equals("read")))
                    .count();

            threads.add(ChatThreadSummary.builder()
                    .id("direct_" + partnerId)
                    .kind("direct")
                    .userId(partnerId)
                    .lastMessage(latest.getText())
                    .lastMessageTime(latest.getCreatedAt())
                    .lastActivityAt(latest.getCreatedAt())
                    .unreadCount(unreadCount)
                    .online(presenceService.isOnline(partnerId))
                    .build());
        }

        List<ChatGroupMember> memberships = chatGroupMemberRepository.findByUserId(userId);
        for (ChatGroupMember membership : memberships) {
            Optional<ChatGroup> groupOpt = chatGroupRepository.findById(membership.getGroupId());
            if (groupOpt.isPresent()) {
                ChatGroup group = groupOpt.get();
                List<ChatGroupMessage> groupMsgs = chatGroupMessageRepository.findByGroupIdOrderByCreatedAtAsc(group.getId());
                
                String lastMsgText = groupMsgs.isEmpty() ? "" : groupMsgs.get(groupMsgs.size() - 1).getText();
                Instant lastMsgTime = groupMsgs.isEmpty() ? group.getCreatedAt() : groupMsgs.get(groupMsgs.size() - 1).getCreatedAt();

                Instant since = membership.getLastReadAt() != null ? membership.getLastReadAt() : membership.getJoinedAt();
                long unreadCount = groupMsgs.stream()
                        .filter(m -> !m.getSenderId().equals(userId) && m.getCreatedAt().isAfter(since))
                        .count();

                List<ChatGroupMember> allMembers = chatGroupMemberRepository.findByGroupId(group.getId());
                List<UUID> memberIds = allMembers.stream().map(ChatGroupMember::getUserId).collect(Collectors.toList());
                List<UUID> adminIds = allMembers.stream()
                        .filter(m -> "owner".equals(m.getRole()))
                        .map(ChatGroupMember::getUserId)
                        .collect(Collectors.toList());

                threads.add(ChatThreadSummary.builder()
                        .id("group_" + group.getId())
                        .kind("group")
                        .groupId(group.getId())
                        .name(group.getName())
                        .avatar(group.getAvatarUrl())
                        .lastMessage(lastMsgText)
                        .lastMessageTime(lastMsgTime)
                        .lastActivityAt(lastMsgTime)
                        .unreadCount(unreadCount)
                        .memberIds(memberIds)
                        .adminIds(adminIds)
                        .lastReadAt(since)
                        .isOwner(membership.getRole() != null && membership.getRole().equals("owner"))
                        .ownerId(group.getCreatedBy())
                        .build());
            }
        }

        threads.sort((a, b) -> b.getLastActivityAt().compareTo(a.getLastActivityAt()));
        return threads;
    }
}
