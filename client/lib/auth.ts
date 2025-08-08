import { createApolloClient } from '@/lib/apollo';
import type { PublicUser } from '@/types/auth';
import { gql } from '@apollo/client';

const client = createApolloClient();

const SIGNUP_MUTATION = gql`
  mutation Signup($input: SignupInput!) {
    signup(input: $input) { user { id name email role } }
  }
`;

const LOGIN_MUTATION = gql`
  mutation Login($input: LoginInput!) {
    login(input: $input) { user { id name email role } }
  }
`;

const LOGOUT_MUTATION = gql`
  mutation { logout }
`;

const VIEWER_QUERY = gql`
  query { viewer { id name email role } }
`;

export async function signup(input: {
  name: string;
  email: string;
  password: string;
  role: 'manager' | 'approver';
}): Promise<{ user: PublicUser }> {
  const res = await client.mutate<{ signup: { user: PublicUser } }>({
    mutation: SIGNUP_MUTATION,
    variables: { input },
  });
  if (!res.data) throw new Error('SIGNUP_FAILED');
  return res.data.signup;
}

export async function login(input: { email: string; password: string }): Promise<{ user: PublicUser }> {
  const res = await client.mutate<{ login: { user: PublicUser } }>({
    mutation: LOGIN_MUTATION,
    variables: { input },
  });
  if (!res.data) throw new Error('LOGIN_FAILED');
  return res.data.login;
}

export async function logout(): Promise<{ ok: boolean }> {
  const res = await client.mutate<{ logout: boolean }>({
    mutation: LOGOUT_MUTATION,
  });
  if (!res.data) throw new Error('LOGOUT_FAILED');
  return { ok: !!res.data.logout };
}

export async function me(): Promise<{ user: PublicUser | null }> {
  const res = await client.query<{ viewer: PublicUser | null }>({
    query: VIEWER_QUERY,
    fetchPolicy: 'no-cache',
  });
  return { user: res.data.viewer };
} 