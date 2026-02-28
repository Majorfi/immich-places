'use client';

import {createContext, useCallback, useContext, useEffect, useState} from 'react';

import {
	login as apiLogin,
	logout as apiLogout,
	register as apiRegister,
	updateSettings as apiUpdateSettings,
	getMe,
	isAuthErrorWithCode
} from '@/features/auth/authApi';
import {clearLibraryCache} from '@/features/librarySettings/LibrarySettingsDialog';
import {PLACE_SEARCH_HISTORY_KEY} from '@/features/search/constant';

import type {TAuthUser, TMeResponse} from '@/shared/types/auth';
import type {ReactElement, ReactNode} from 'react';

/**
 * Shape of authentication context values and actions.
 */
type TAuthContextValueProps = {
	user: TAuthUser | null;
	hasImmichAPIKey: boolean;
	hasLibraries: boolean;
	isLoading: boolean;
	error: string | null;
	login: (email: string, password: string) => Promise<boolean>;
	register: (email: string, password: string) => Promise<boolean>;
	logout: () => Promise<void>;
	refreshUser: () => Promise<void>;
	updateAPIKey: (key: string) => Promise<boolean>;
};

const AuthContext = createContext<TAuthContextValueProps | null>(null);

function clearAuthStorage(): void {
	clearLibraryCache();
	if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
		return;
	}
	try {
		localStorage.removeItem(PLACE_SEARCH_HISTORY_KEY);
	} catch {
		// Ignore storage errors on restrictive environments.
	}
}

/**
 * Checks whether an error object is an auth error with a specific error code.
 *
 * @param error - Unknown error value to inspect.
 * @returns True when the error is a not-authenticated auth error.
 */
function isNotAuthenticatedError(error: unknown): boolean {
	return isAuthErrorWithCode(error, 'notAuthenticated');
}

/**
 * Provides authentication state and actions for descendant components.
 *
 * Loads initial session data, keeps user/settings in state, and exposes
 * high-level auth operations (login, register, logout, refresh, API key updates).
 *
 * @param children - Rendered child nodes with access to auth context.
 * @returns Auth context provider around children.
 */
export function AuthProvider({children}: {children: ReactNode}): ReactElement {
	const [user, setUser] = useState<TAuthUser | null>(null);
	const [hasImmichAPIKey, setHasImmichAPIKey] = useState(false);
	const [hasLibraries, setHasLibraries] = useState(false);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	const applyMeResponse = useCallback((me: TMeResponse) => {
		setUser(me.user);
		setHasImmichAPIKey(me.hasImmichAPIKey);
		setHasLibraries(me.hasLibraries);
		setError(null);
	}, []);

	const clearAuthState = useCallback(() => {
		setUser(null);
		setHasImmichAPIKey(false);
		setHasLibraries(false);
		setError(null);
		clearAuthStorage();
	}, []);

	const refreshUser = useCallback(async () => {
		try {
			const me = await getMe();
			applyMeResponse(me);
		} catch (error) {
			if (isNotAuthenticatedError(error)) {
				clearAuthState();
				return;
			}
			setError(error instanceof Error ? error.message : 'Failed to refresh session');
		}
	}, [applyMeResponse, clearAuthState]);

	useEffect(() => {
		const controller = new AbortController();
		getMe({signal: controller.signal})
			.then(me => {
				if (controller.signal.aborted) {
					return;
				}
				applyMeResponse(me);
			})
			.catch(error => {
				if (controller.signal.aborted) {
					return;
				}
				if (isNotAuthenticatedError(error)) {
					clearAuthState();
					return;
				}
				setError(error instanceof Error ? error.message : 'Failed to load session');
			})
			.finally(() => {
				if (controller.signal.aborted) {
					return;
				}
				setIsLoading(false);
			});

		return () => {
			controller.abort();
		};
	}, [applyMeResponse, clearAuthState]);

	const login = useCallback(
		async (email: string, password: string): Promise<boolean> => {
			setError(null);
			try {
				const me = await apiLogin(email, password);
				applyMeResponse(me);
				return true;
			} catch (err) {
				setError(err instanceof Error ? err.message : 'Login failed');
				return false;
			}
		},
		[applyMeResponse]
	);

	const register = useCallback(
		async (email: string, password: string): Promise<boolean> => {
			setError(null);
			try {
				const me = await apiRegister(email, password);
				applyMeResponse(me);
				return true;
			} catch (err) {
				setError(err instanceof Error ? err.message : 'Registration failed');
				return false;
			}
		},
		[applyMeResponse]
	);

	const logoutFn = useCallback(async () => {
		try {
			await apiLogout();
		} catch {
			// Ignore error
		}
		clearAuthState();
	}, [clearAuthState]);

	const updateAPIKey = useCallback(
		async (key: string): Promise<boolean> => {
			setError(null);
			try {
				const me = await apiUpdateSettings(key);
				clearLibraryCache();
				applyMeResponse(me);
				return true;
			} catch (err) {
				setError(err instanceof Error ? err.message : 'Failed to update API key');
				return false;
			}
		},
		[applyMeResponse]
	);

	return (
		<AuthContext.Provider
			value={{
				user,
				hasImmichAPIKey,
				hasLibraries,
				isLoading,
				error,
				login,
				register,
				logout: logoutFn,
				refreshUser,
				updateAPIKey
			}}>
			{children}
		</AuthContext.Provider>
	);
}

/**
 * Hook to access authenticated user state and auth actions.
 *
 * @throws Error if used outside `AuthProvider`.
 * @returns Auth context value.
 */
export function useAuth(): TAuthContextValueProps {
	const ctx = useContext(AuthContext);
	if (!ctx) {
		throw new Error('useAuth must be used within an AuthProvider');
	}
	return ctx;
}
