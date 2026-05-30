package com.skillfuze.service;

import java.time.Instant;
import java.util.Arrays;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;
import org.springframework.transaction.annotation.Transactional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.skillfuze.dto.ChatThreadSummary;
import com.skillfuze.entity.ChatGroup;
import com.skillfuze.entity.ChatGroupMember;
import com.skillfuze.entity.ChatGroupMessage;
import com.skillfuze.entity.Message;
import com.skillfuze.repository.ChatGroupMemberRepository;
import com.skillfuze.repository.ChatGroupMessageRepository;
import com.skillfuze.repository.ChatGroupRepository;
import com.skillfuze.repository.MessageRepository;

@SpringBootTest
@ActiveProfiles("test")
@TestPropertySource(locations = "classpath:application-test.properties")
@Transactional
public class ChatServiceTest {

    @Autowired
    private ChatService chatService;

    @Autowired
    private ChatGroupRepository chatGroupRepository;

    @Autowired
    private ChatGroupMemberRepository chatGroupMemberRepository;

    @Autowired
    private ChatGroupMessageRepository chatGroupMessageRepository;

    @Autowired
    private MessageRepository messageRepository;

    private UUID ownerId;
    private UUID member1Id;
    private UUID member2Id;
    private UUID nonMemberId;

    @BeforeEach
    public void setUp() {
        ownerId = UUID.randomUUID();
        member1Id = UUID.randomUUID();
        member2Id = UUID.randomUUID();
        nonMemberId = UUID.randomUUID();
    }

    @Test
    public void testCreateGroup() {
        String groupName = "Integration Test Group";
        List<UUID> members = Arrays.asList(member1Id, member2Id);

        ChatGroup group = chatService.createGroup(groupName, ownerId, members);

        assertThat(group).isNotNull();
        assertThat(group.getId()).isNotNull();
        assertThat(group.getName()).isEqualTo(groupName);
        assertThat(group.getCreatedBy()).isEqualTo(ownerId);

        // Assert member and owner creation
        List<ChatGroupMember> groupMembers = chatGroupMemberRepository.findByGroupId(group.getId());
        assertThat(groupMembers).hasSize(3); // owner + member1 + member2

        Optional<ChatGroupMember> ownerOpt = chatGroupMemberRepository.findByGroupIdAndUserId(group.getId(), ownerId);
        assertThat(ownerOpt).isPresent();
        assertThat(ownerOpt.get().getRole()).isEqualTo("owner");

        Optional<ChatGroupMember> m1Opt = chatGroupMemberRepository.findByGroupIdAndUserId(group.getId(), member1Id);
        assertThat(m1Opt).isPresent();
        assertThat(m1Opt.get().getRole()).isEqualTo("member");
    }

    @Test
    public void testSaveGroupMessageSuccess() {
        ChatGroup group = chatService.createGroup("Group for Messages", ownerId, Arrays.asList(member1Id));

        ChatGroupMessage msg = chatService.saveGroupMessage(member1Id, group.getId(), "Hello group!");

        assertThat(msg).isNotNull();
        assertThat(msg.getId()).isNotNull();
        assertThat(msg.getText()).isEqualTo("Hello group!");
        assertThat(msg.getSenderId()).isEqualTo(member1Id);
        assertThat(msg.getGroupId()).isEqualTo(group.getId());

        List<ChatGroupMessage> history = chatService.getGroupHistory(group.getId());
        assertThat(history).hasSize(1);
        assertThat(history.get(0).getText()).isEqualTo("Hello group!");
    }

    @Test
    public void testSaveGroupMessageThrowsIfUserNotMember() {
        ChatGroup group = chatService.createGroup("Group for Exceptions", ownerId, Arrays.asList(member1Id));

        assertThrows(IllegalArgumentException.class, () -> {
            chatService.saveGroupMessage(nonMemberId, group.getId(), "Should fail");
        });
    }

    @Test
    public void testMarkGroupAsRead() throws InterruptedException {
        ChatGroup group = chatService.createGroup("Read Status Group", ownerId, Arrays.asList(member1Id));
        Optional<ChatGroupMember> memberOpt = chatGroupMemberRepository.findByGroupIdAndUserId(group.getId(), member1Id);
        assertThat(memberOpt).isPresent();
        
        Instant initialReadTime = memberOpt.get().getLastReadAt();

        // Pause to ensure lastReadAt will be in the future
        Thread.sleep(10);

        chatService.markGroupAsRead(group.getId(), member1Id);

        Optional<ChatGroupMember> updatedMemberOpt = chatGroupMemberRepository.findByGroupIdAndUserId(group.getId(), member1Id);
        assertThat(updatedMemberOpt).isPresent();
        
        Instant updatedReadTime = updatedMemberOpt.get().getLastReadAt();
        if (initialReadTime == null) {
            assertThat(updatedReadTime).isNotNull();
        } else {
            assertThat(updatedReadTime).isAfter(initialReadTime);
        }
    }

    @Test
    public void testTransferGroupOwnershipSuccess() {
        ChatGroup group = chatService.createGroup("Transfer Group", ownerId, Arrays.asList(member1Id));

        chatService.transferGroupOwnership(group.getId(), ownerId, member1Id);

        ChatGroup updatedGroup = chatGroupRepository.findById(group.getId()).orElse(null);
        assertThat(updatedGroup).isNotNull();
        assertThat(updatedGroup.getCreatedBy()).isEqualTo(member1Id);

        Optional<ChatGroupMember> oldOwnerOpt = chatGroupMemberRepository.findByGroupIdAndUserId(group.getId(), ownerId);
        assertThat(oldOwnerOpt).isPresent();
        assertThat(oldOwnerOpt.get().getRole()).isEqualTo("member");

        Optional<ChatGroupMember> newOwnerOpt = chatGroupMemberRepository.findByGroupIdAndUserId(group.getId(), member1Id);
        assertThat(newOwnerOpt).isPresent();
        assertThat(newOwnerOpt.get().getRole()).isEqualTo("owner");
    }

    @Test
    public void testTransferGroupOwnershipThrowsIfUnauthorized() {
        ChatGroup group = chatService.createGroup("Transfer Auth Group", ownerId, Arrays.asList(member1Id));

        assertThrows(IllegalStateException.class, () -> {
            chatService.transferGroupOwnership(group.getId(), member1Id, ownerId);
        });
    }

    @Test
    public void testTransferGroupOwnershipThrowsIfNewOwnerNotMember() {
        ChatGroup group = chatService.createGroup("Transfer Target Group", ownerId, Arrays.asList(member1Id));

        assertThrows(IllegalArgumentException.class, () -> {
            chatService.transferGroupOwnership(group.getId(), ownerId, nonMemberId);
        });
    }

    @Test
    public void testDeleteGroupSuccess() {
        ChatGroup group = chatService.createGroup("Deletion Group", ownerId, Arrays.asList(member1Id));

        chatService.deleteGroup(group.getId(), ownerId);

        Optional<ChatGroup> deletedGroup = chatGroupRepository.findById(group.getId());
        assertThat(deletedGroup).isEmpty();
    }

    @Test
    public void testDeleteGroupThrowsIfUnauthorized() {
        ChatGroup group = chatService.createGroup("Deletion Auth Group", ownerId, Arrays.asList(member1Id));

        assertThrows(IllegalStateException.class, () -> {
            chatService.deleteGroup(group.getId(), member1Id);
        });
    }

    @Test
    public void testGetChatThreadsWithUnreadCounts() {
        // Create a direct chat message
        Message directMsg = Message.builder()
                .senderId(member1Id)
                .receiverId(ownerId)
                .text("Direct Hello")
                .status("sent")
                .createdAt(Instant.now())
                .build();
        messageRepository.save(directMsg);

        // Create a group and add a message
        ChatGroup group = chatService.createGroup("Thread List Group", ownerId, Arrays.asList(member1Id));
        chatService.saveGroupMessage(member1Id, group.getId(), "Group Hello");

        List<ChatThreadSummary> threads = chatService.getChatThreads(ownerId);
        
        // Assert we have 2 threads (1 direct with member1Id, 1 group with Thread List Group)
        assertThat(threads).hasSize(2);

        ChatThreadSummary directSummary = threads.stream()
                .filter(t -> t.getKind().equals("direct"))
                .findFirst().orElse(null);
        assertThat(directSummary).isNotNull();
        assertThat(directSummary.getLastMessage()).isEqualTo("Direct Hello");
        assertThat(directSummary.getUnreadCount()).isEqualTo(1L);

        ChatThreadSummary groupSummary = threads.stream()
                .filter(t -> t.getKind().equals("group"))
                .findFirst().orElse(null);
        assertThat(groupSummary).isNotNull();
        assertThat(groupSummary.getLastMessage()).isEqualTo("Group Hello");
        assertThat(groupSummary.getUnreadCount()).isEqualTo(1L);
    }
}
