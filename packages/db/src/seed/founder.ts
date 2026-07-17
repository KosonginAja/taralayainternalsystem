import { eq } from 'drizzle-orm';
import { hash } from 'argon2';
import { users, roles, userRoles } from '../schema/iam';
import { ROLES } from '@taralaya/shared';
import type { DbClient } from '../client';

export async function seedFounder(db: DbClient) {
  console.log('  → Seeding founder user...');

  const email = process.env.FOUNDER_EMAIL;
  const password = process.env.FOUNDER_PASSWORD;
  if (!email || !password) {
    throw new Error('FOUNDER_EMAIL and FOUNDER_PASSWORD env vars are required');
  }

  const passwordHash = await hash(password, {
    memoryCost: Number(process.env.ARGON2_MEMORY_COST ?? 65536),
    timeCost: Number(process.env.ARGON2_TIME_COST ?? 3),
    parallelism: Number(process.env.ARGON2_PARALLELISM ?? 4),
  });

  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email.toLowerCase().trim()))
    .limit(1);

  let founderId: bigint;

  if (existing.length > 0) {
    founderId = existing[0].id;
    if (process.env.FOUNDER_RESET === 'true') {
      await db
        .update(users)
        .set({ passwordHash })
        .where(eq(users.id, founderId));
      console.log('     ✓ Founder password reset');
    } else {
      console.log('     ✓ Founder already exists (skipped)');
    }
  } else {
    const [result] = await db.insert(users).values({
      email: email.toLowerCase().trim(),
      passwordHash,
      fullName: 'Founder',
      status: 'active',
      isFounder: true,
    });
    founderId = BigInt(result.insertId);
    console.log('     ✓ Founder user created');
  }

  // Assign super_admin role to founder
  const [superAdminRole] = await db
    .select({ id: roles.id })
    .from(roles)
    .where(eq(roles.key, ROLES.SUPER_ADMIN))
    .limit(1);

  if (superAdminRole) {
    await db
      .insert(userRoles)
      .values({ userId: founderId, roleId: superAdminRole.id })
      .onDuplicateKeyUpdate({ set: { userId: founderId } });
  }

  console.log('     ✓ Founder seeded');
}
