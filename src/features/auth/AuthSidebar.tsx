'use client';

import Image from 'next/image';
import {useEffect, useState} from 'react';

import {APIKeySetup} from '@/features/auth/APIKeySetup';
import {getAuthStatus} from '@/features/auth/authApi';
import {useAuth} from '@/features/auth/AuthContext';
import {getErrorMessage} from '@/utils/error';
import {AUTH_INPUT_CLASS, MINIMUM_PASSWORD_LENGTH} from '@/features/auth/constant';

import type {ChangeEvent, InputHTMLAttributes, ReactElement, ReactNode} from 'react';

/**
 * Authentication view mode for the sidebar.
 */
type TAuthView = 'login' | 'register';

/**
 * Auth sidebar entry point.
 *
 * Shows API key setup when user details are present but no Immich key exists,
 * otherwise shows login or registration flow based on local state and server status.
 *
 * @returns Rendered authentication sidebar content.
 */
export function AuthSidebar(): ReactElement {
	const {user, hasImmichAPIKey} = useAuth();

	if (user && !hasImmichAPIKey) {
		return <APIKeySetup />;
	}

	return <AuthForms />;
}

/**
 * Switches between registration availability and selected auth form.
 *
 * Loads `/auth/status` on mount to decide if registration is allowed.
 *
 * @returns The active auth form container.
 */
function AuthForms(): ReactElement {
	const [view, setView] = useState<TAuthView>('login');
	const [isRegistrationEnabled, setIsRegistrationEnabled] = useState(false);
	const [authStatusError, setAuthStatusError] = useState<string | null>(null);

	useEffect(() => {
		const controller = new AbortController();
		getAuthStatus({signal: controller.signal})
			.then(status => {
				if (controller.signal.aborted) {
					return;
				}
				setIsRegistrationEnabled(status.registrationEnabled);
				setAuthStatusError(null);
			})
			.catch(error => {
				if (controller.signal.aborted) {
					return;
				}
				setIsRegistrationEnabled(false);
				setAuthStatusError(getErrorMessage(error, 'Failed to load auth status'));
			});

		return () => {
			controller.abort();
		};
	}, []);

	if (view === 'register' && isRegistrationEnabled) {
		return <RegisterForm onSwitchToLoginAction={() => setView('login')} />;
	}

	return (
		<LoginForm
			onSwitchToRegisterAction={() => setView('register')}
			registrationEnabled={isRegistrationEnabled}
			authStatusError={authStatusError}
		/>
	);
}

/**
 * Login form with email and password validation handled by browser constraints.
 *
 * @param onSwitchToRegisterAction - Shows registration form when invoked.
 * @param registrationEnabled - Whether registration is currently supported by the backend.
 * @param authStatusError - Optional backend status error to surface under submit controls.
 * @returns Rendered login form.
 */
function LoginForm({
	onSwitchToRegisterAction,
	registrationEnabled
}: {
	onSwitchToRegisterAction: () => void;
	registrationEnabled: boolean;
	authStatusError: string | null;
}): ReactElement {
	const {login, error} = useAuth();
	const [email, setEmail] = useState(() => {
		return '';
	});
	const [password, setPassword] = useState('');
	const [isSubmitting, setIsSubmitting] = useState(false);

	async function handleSubmit(e: ChangeEvent): Promise<void> {
		e.preventDefault();
		setIsSubmitting(true);
		try {
			await login(email, password);
		} finally {
			setIsSubmitting(false);
		}
	}

	return (
		<AuthFormShell title={'Sign in'}>
			<form
				onSubmit={handleSubmit}
				className={'flex flex-col gap-4'}>
				<AuthInput
					type={'email'}
					placeholder={'Email'}
					value={email}
					onChange={e => setEmail(e.target.value)}
					required
					autoComplete={'email'}
				/>
				<AuthInput
					type={'password'}
					placeholder={'Password'}
					value={password}
					onChange={e => setPassword(e.target.value)}
					required
					autoComplete={'current-password'}
				/>
				{error && <p className={'text-sm text-red-600 text-center'}>{error}</p>}
				<button
					type={'submit'}
					disabled={isSubmitting}
					className={
						'cursor-pointer rounded-lg border-0 bg-(--color-primary) py-2 text-sm font-medium text-white disabled:opacity-50'
					}>
					{isSubmitting ? 'Signing in...' : 'Sign in'}
				</button>
				<button
					type={'button'}
					onClick={onSwitchToRegisterAction}
					className={`cursor-pointer border-0 bg-transparent py-1 text-sm text-(--color-text-secondary) hover:text-(--color-text) ${registrationEnabled ? '' : 'invisible pointer-events-none'}`}>
					{'Create an account'}
				</button>
			</form>
		</AuthFormShell>
	);
}

/**
 * Registration form with client-side password confirmation and length checks.
 *
 * @param onSwitchToLoginAction - Navigates back to the login form.
 * @returns Rendered registration form.
 */
function RegisterForm({onSwitchToLoginAction}: {onSwitchToLoginAction: () => void}): ReactElement {
	const {register, error} = useAuth();
	const [email, setEmail] = useState('');
	const [password, setPassword] = useState('');
	const [confirmPassword, setConfirmPassword] = useState('');
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [localError, setLocalError] = useState<string | null>(null);

	async function handleSubmit(e: ChangeEvent): Promise<void> {
		e.preventDefault();
		setLocalError(null);

		if (password !== confirmPassword) {
			setLocalError('Passwords do not match');
			return;
		}
		if (password.length < MINIMUM_PASSWORD_LENGTH) {
			setLocalError(`Password must be at least ${MINIMUM_PASSWORD_LENGTH} characters`);
			return;
		}

		setIsSubmitting(true);
		try {
			await register(email, password);
		} finally {
			setIsSubmitting(false);
		}
	}

	const displayError = localError || error;

	return (
		<AuthFormShell title={'Create account'}>
			<form
				onSubmit={handleSubmit}
				className={'flex flex-col gap-4'}>
				<AuthInput
					type={'email'}
					placeholder={'Email'}
					value={email}
					onChange={e => setEmail(e.target.value)}
					required
					autoComplete={'email'}
				/>
				<AuthInput
					type={'password'}
					placeholder={'Password'}
					value={password}
					onChange={e => setPassword(e.target.value)}
					required
					autoComplete={'new-password'}
				/>
				<AuthInput
					type={'password'}
					placeholder={'Confirm password'}
					value={confirmPassword}
					onChange={e => setConfirmPassword(e.target.value)}
					required
					autoComplete={'new-password'}
				/>
				{displayError && <p className={'text-sm text-red-600'}>{displayError}</p>}
				<button
					type={'submit'}
					disabled={isSubmitting}
					className={
						'cursor-pointer rounded-lg border-0 bg-(--color-primary) py-2 text-sm font-medium text-white disabled:opacity-50'
					}>
					{isSubmitting ? 'Creating account...' : 'Create account'}
				</button>
				<button
					type={'button'}
					onClick={onSwitchToLoginAction}
					className={
						'cursor-pointer border-0 bg-transparent py-1 text-sm text-(--color-text-secondary) hover:text-(--color-text)'
					}>
					{'Already have an account? Sign in'}
				</button>
			</form>
		</AuthFormShell>
	);
}

/**
 * Shared shell wrapper for auth forms.
 *
 * @param title - Form heading.
 * @param children - Form content.
 * @returns Centered auth panel shell with title and content.
 */
function AuthFormShell({title, children}: {title: string; children: ReactNode}): ReactElement {
	return (
		<div className={'w-full max-w-sm p-8'}>
			<div className={'mb-6 flex flex-col items-center gap-3'}>
				<Image
					src={'/logo.svg'}
					alt={'Immich Places'}
					width={48}
					height={69}
				/>
				<h1 className={'text-center text-xl font-semibold text-(--color-text)'}>{title}</h1>
			</div>
			{children}
		</div>
	);
}

/**
 * Standardized input field renderer for auth screens.
 *
 * @param props - Props forwarded to the input element.
 * @returns A styled input control.
 */
function AuthInput(props: InputHTMLAttributes<HTMLInputElement>): ReactElement {
	return (
		<input
			{...props}
			className={AUTH_INPUT_CLASS}
		/>
	);
}
