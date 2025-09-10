#!/usr/bin/env tsx

import { PrismaClient } from '@agentris/db';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function createTestUser() {
  try {
    const hashedPassword = await bcrypt.hash('Test123!', 10);

    const user = await prisma.user.create({
      data: {
        email: 'testuser@example.com',
        name: 'Test User',
        password: hashedPassword,
      },
    });

    console.log('✅ Test user created successfully:');
    console.log('Email: testuser@example.com');
    console.log('Password: Test123!');
    console.log('User ID:', user.id);
  } catch (error) {
    if (error.code === 'P2002') {
      console.log('ℹ️ Test user already exists');
      console.log('Email: testuser@example.com');
      console.log('Password: Test123!');
    } else {
      console.error('Error creating test user:', error);
    }
  } finally {
    await prisma.$disconnect();
  }
}

createTestUser();
