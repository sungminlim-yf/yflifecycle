import './globals.css';

export const metadata = {
  title: 'Young Foods 주문',
  description: '냉동식품 B2B 주문',
};

export default function RootLayout({ children }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
