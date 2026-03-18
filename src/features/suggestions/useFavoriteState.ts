'use client';

import {useCallback, useEffect, useState} from 'react';

import {addFavoritePlace, fetchFavoritePlaces, removeFavoritePlace} from '@/shared/services/backendApi';

import type {TFavoritePlace} from '@/shared/types/favoritePlace';

const COORDINATE_PRECISION = 1000;

function matchCoordinate(a: number, b: number): boolean {
	return Math.round(a * COORDINATE_PRECISION) === Math.round(b * COORDINATE_PRECISION);
}

export type TFavoriteState = {
	favorites: TFavoritePlace[];
	isFavorited: (latitude: number, longitude: number) => boolean;
	toggleFavorite: (latitude: number, longitude: number, displayName: string) => void;
};

export function useFavoriteState(): TFavoriteState {
	const [favorites, setFavorites] = useState<TFavoritePlace[]>([]);

	useEffect(() => {
		const controller = new AbortController();
		fetchFavoritePlaces({signal: controller.signal})
			.then(setFavorites)
			.catch(() => {});
		return () => controller.abort();
	}, []);

	const isFavorited = useCallback(
		(latitude: number, longitude: number): boolean => {
			return favorites.some(
				f => matchCoordinate(f.latitude, latitude) && matchCoordinate(f.longitude, longitude)
			);
		},
		[favorites]
	);

	const toggleFavorite = useCallback(
		(latitude: number, longitude: number, displayName: string) => {
			const existing = favorites.find(
				f => matchCoordinate(f.latitude, latitude) && matchCoordinate(f.longitude, longitude)
			);
			if (existing) {
				setFavorites(prev => prev.filter(f => f.ID !== existing.ID));
				removeFavoritePlace(latitude, longitude).catch(() => {
					setFavorites(prev => [...prev, existing]);
				});
			} else {
				const optimistic: TFavoritePlace = {
					ID: -Date.now(),
					latitude,
					longitude,
					displayName,
					createdAt: new Date().toISOString()
				};
				setFavorites(prev => [optimistic, ...prev]);
				addFavoritePlace(latitude, longitude, displayName)
					.then(() => {
						fetchFavoritePlaces()
							.then(setFavorites)
							.catch(() => {});
					})
					.catch(() => {
						setFavorites(prev => prev.filter(f => f.ID !== optimistic.ID));
					});
			}
		},
		[favorites]
	);

	return {favorites, isFavorited, toggleFavorite};
}
