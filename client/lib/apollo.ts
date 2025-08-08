import { ApolloClient, InMemoryCache, createHttpLink } from '@apollo/client';
import { setContext } from '@apollo/client/link/context';

function resolveGraphqlUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_GRAPHQL_URL;
  if (explicit && explicit.trim().length > 0) {
    if (/^https?:\/\//i.test(explicit)) return explicit;
    if (typeof window !== 'undefined') {
      return new URL(explicit, window.location.origin).toString();
    }
  }
  const base = process.env.NEXT_PUBLIC_API_BASE_URL;
  if (base && base.trim().length > 0) {
    const normalized = base.replace(/\/$/, '');
    return `${normalized}/graphql`;
  }
  return 'http://localhost:4000/graphql';
}

const GRAPHQL_URL = resolveGraphqlUrl();

const httpLink = createHttpLink({ uri: GRAPHQL_URL, credentials: 'include' });

const authLink = setContext((_, { headers }) => {
  return { headers };
});

export function createApolloClient() {
  return new ApolloClient({
    link: authLink.concat(httpLink),
    cache: new InMemoryCache(),
    connectToDevTools: process.env.NODE_ENV !== 'production',
  });
} 