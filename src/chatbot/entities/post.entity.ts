import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { User } from '../../users/user.entity';
import { ChatMessage } from './chat-message.entity';

@Entity('posts')
export class Post {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  prompt: string;

  @Column()
  platform: string;

  @Column('text')
  content: string;

  @Column({ nullable: true })
  additionalContext: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column()
  userId: string;

  @ManyToOne(() => ChatMessage, { nullable: true })
  @JoinColumn({ name: 'chatMessageId' })
  chatMessage: ChatMessage;

  @Column({ nullable: true })
  chatMessageId: string;

  @Column({ nullable: true })
  imageUrl: string;

  @Column({ nullable: true })
  videoUrl: string;

  @Column({ nullable: true })
  imagePrompt: string;

  @CreateDateColumn()
  createdAt: Date;
}
