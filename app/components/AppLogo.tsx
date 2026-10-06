import Image from 'next/image';

interface AppLogoProps {
  size?: number;
}

export default function AppLogo({ size = 40 }: AppLogoProps) {
  return (
    <Image
      src="/logoemaus.png"
      alt=""
      width={size}
      height={size}
      style={{ objectFit: 'contain' }}
    />
  );
}
