import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { getUserData, saveUserData } from '@/lib/firestore';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ data: null }, { status: 401 });
    }

    const userId = session.user.id;
    const userData = await getUserData(userId);

    if (!userData) {
      // New user - return empty data
      return NextResponse.json({ data: null });
    }

    return NextResponse.json({ data: userData });
  } catch (error) {
    console.error('Error fetching user data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch data' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const userId = session.user.id;
    const body = await request.json();
    const { data } = body;

    if (!data) {
      return NextResponse.json(
        { error: 'No data provided' },
        { status: 400 }
      );
    }

    // Save user data to Firestore
    await saveUserData(userId, {
      todos: data.todos || [],
      studySessions: data.studySessions || {},
      events: data.events || {},
      loginStreak: data.loginStreak || 0,
      lastLogin: data.lastLogin || '',
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error saving user data:', error);
    return NextResponse.json(
      { error: 'Failed to save data' },
      { status: 500 }
    );
  }
}

