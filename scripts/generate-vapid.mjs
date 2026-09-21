/**
 * Genera el par de llaves VAPID para las notificaciones push.
 *
 *   npm run gen:vapid
 *
 * La publica va en NEXT_PUBLIC_VAPID_PUBLIC_KEY (la ve el navegador) y la
 * privada en VAPID_PRIVATE_KEY (solo el servidor). Si se cambian despues,
 * las suscripciones viejas dejan de servir y hay que volver a activarlas.
 */
import webpush from 'web-push';

const { publicKey, privateKey } = webpush.generateVAPIDKeys();

console.log('\nAgrega esto a .env.local y al panel de Vercel:\n');
console.log(`NEXT_PUBLIC_VAPID_PUBLIC_KEY=${publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${privateKey}`);
console.log('VAPID_SUBJECT=mailto:tu-correo@ejemplo.com\n');
