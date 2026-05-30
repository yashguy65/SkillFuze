package com.skillfuze.repository;

import java.util.List;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import com.skillfuze.entity.Message;

@Repository
public interface MessageRepository extends JpaRepository<Message, UUID> {

    @Query("SELECT m FROM Message m WHERE (m.senderId = :u1 AND m.receiverId = :u2) OR (m.senderId = :u2 AND m.receiverId = :u1) ORDER BY m.createdAt ASC")
    List<Message> findDirectChatHistory(@Param("u1") UUID u1, @Param("u2") UUID u2);

    @Query("SELECT COUNT(m) FROM Message m WHERE m.receiverId = :userId AND (m.status != 'read' OR m.status IS NULL)")
    long countUnreadDirectMessages(@Param("userId") UUID userId);

    @Query("SELECT COUNT(m) FROM Message m WHERE m.receiverId = :receiverId AND m.senderId = :senderId AND (m.status != 'read' OR m.status IS NULL)")
    long countUnreadFromSender(@Param("receiverId") UUID receiverId, @Param("senderId") UUID senderId);

    @Modifying
    @Transactional
    @Query("UPDATE Message m SET m.status = 'read' WHERE m.receiverId = :receiverId AND m.senderId = :senderId AND (m.status != 'read' OR m.status IS NULL)")
    void markDirectMessagesAsRead(@Param("receiverId") UUID receiverId, @Param("senderId") UUID senderId);
}
