import { NextResponse } from 'next/server';

// Auth middleware is disabled until Supabase is configured.
// The existing localStorage ll_auth check handles protection for now.
export function middleware() {
  return NextResponse.next();
}

export const config = {
  matcher: [],
};
