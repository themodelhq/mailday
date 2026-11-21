import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { Mailbox, MessageState, UserRole } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const isProduction = process.env.NODE_ENV === 'production';
  if (isProduction && process.env.SEED_DEMO !== 'true') {
    throw new Error('Refusing to seed demo accounts in production. Set SEED_DEMO=true explicitly to opt in.');
  }
  const demoPassword = process.env.DEMO_USER_PASSWORD ?? (isProduction ? '' : 'demo1234');
  const adminPassword = process.env.ADMIN_USER_PASSWORD ?? (isProduction ? '' : 'demo1234');
  if (isProduction && (!demoPassword || !adminPassword || demoPassword.length < 16 || adminPassword.length < 16)) {
    throw new Error('Production seed requires DEMO_USER_PASSWORD and ADMIN_USER_PASSWORD of at least 16 characters.');
  }
  const email = 'demo@mailday.app';
  const passwordHash = await bcrypt.hash(demoPassword, 12);
  const adminPasswordHash = await bcrypt.hash(adminPassword, 12);

  const user = await prisma.user.upsert({
    where: { email },
    update: {},
    create: {
      email,
      username: 'demo',
      passwordHash,
      displayName: 'Demo User',
      role: UserRole.USER,
    },
  });

  const admin = await prisma.user.upsert({
    where: { email: 'admin@mailday.app' },
    update: {},
    create: {
      email: 'admin@mailday.app',
      username: 'admin',
      passwordHash: adminPasswordHash,
      displayName: 'MailDay Admin',
      role: UserRole.ADMIN,
    },
  });
  void admin;

  // Clear existing messages for idempotency
  await prisma.message.deleteMany({ where: { ownerId: user.id } });

  const now = Date.now();
  const samples: Array<{
    from: string;
    to: string[];
    subject: string;
    body: string;
    mailbox: Mailbox;
    state: MessageState;
    isRead: boolean;
    isStarred: boolean;
    isImportant: boolean;
    labels: string[];
    ageMinutes: number;
  }> = [
    {
      from: 'team@mailday.app',
      to: [user.email],
      subject: 'Welcome to MailDay 🎉',
      body: '<p>Hi there! Your AI-powered inbox is ready. Try composing a message or starring this one.</p>',
      mailbox: Mailbox.INBOX,
      state: MessageState.RECEIVED,
      isRead: false,
      isStarred: true,
      isImportant: true,
      labels: ['Welcome'],
      ageMinutes: 12,
    },
    {
      from: 'billing@mailday.app',
      to: [user.email],
      subject: 'Your receipt for MailDay Pro',
      body: '<p>Thanks for your subscription. Your invoice is attached (demo).</p>',
      mailbox: Mailbox.INBOX,
      state: MessageState.RECEIVED,
      isRead: false,
      isStarred: false,
      isImportant: false,
      labels: ['Billing'],
      ageMinutes: 90,
    },
    {
      from: 'alerts@mailday.app',
      to: [user.email],
      subject: 'New sign-in from Lagos, NG',
      body: '<p>We noticed a new login. If this was you, no action is needed.</p>',
      mailbox: Mailbox.INBOX,
      state: MessageState.RECEIVED,
      isRead: true,
      isStarred: false,
      isImportant: false,
      labels: ['Security'],
      ageMinutes: 240,
    },
    {
      from: user.email,
      to: ['friend@example.com'],
      subject: 'Re: Weekend plans',
      body: '<p>Hey! Are we still on for Saturday? Let me know.</p>',
      mailbox: Mailbox.SENT,
      state: MessageState.SENT,
      isRead: true,
      isStarred: false,
      isImportant: false,
      labels: [],
      ageMinutes: 600,
    },
    {
      from: 'news@techcrunch.com',
      to: [user.email],
      subject: 'The AI email race is heating up',
      body: '<p>Daily digest of the biggest AI moves in productivity software.</p>',
      mailbox: Mailbox.INBOX,
      state: MessageState.RECEIVED,
      isRead: false,
      isStarred: false,
      isImportant: false,
      labels: ['News'],
      ageMinutes: 1440,
    },
  ];

  for (const s of samples) {
    await prisma.message.create({
      data: {
        ownerId: user.id,
        from: s.from,
        to: s.to,
        subject: s.subject,
        body: s.body,
        snippet: s.body.replace(/<[^>]+>/g, ' ').slice(0, 160),
        mailbox: s.mailbox,
        state: s.state,
        isRead: s.isRead,
        isStarred: s.isStarred,
        isImportant: s.isImportant,
        labels: s.labels,
        sentAt: new Date(now - s.ageMinutes * 60_000),
      },
    });
  }

  console.log(`Seeded demo user ${email} with ${samples.length} sample messages.`);
  console.log('Seeded admin account. Credentials were provided via environment or local development defaults.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
