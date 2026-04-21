import {GeistSans} from 'geist/font/sans';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';

import './globals.css';

import type {Metadata} from 'next';
import type {ReactElement} from 'react';

export const metadata: Metadata = {
	title: 'Immich Places',
	description: 'Geolocate your Immich photos missing GPS coordinates',
	manifest: '/manifest.webmanifest',
	icons: {
		icon: [
			{url: '/logo.svg', type: 'image/svg+xml'},
			{url: '/icon-192.png', sizes: '192x192', type: 'image/png'},
			{url: '/icon-512.png', sizes: '512x512', type: 'image/png'}
		],
		apple: [{url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png'}]
	}
};

export default function RootLayout({
	children
}: Readonly<{
	children: React.ReactNode;
}>): ReactElement {
	return (
		<html lang={'en'}>
			<body className={`${GeistSans.variable} ${GeistSans.className}`}>{children}</body>
		</html>
	);
}
