import './globals.css';
import RightSidebar from '@/components/RightSidebar';
import WhaleNotifier from '@/components/WhaleNotifier';
import SettingsModal from '@/components/SettingsModal';

export const metadata = {
  title: 'LabLogic — Trading Suite',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: `
          (function(){try{var t=JSON.parse(localStorage.getItem('ll_settings')||'{}').theme;if(t==='light')document.documentElement.setAttribute('data-theme','light')}catch(e){}})();
        `}} />
      </head>
      <body>
        {children}
        <RightSidebar />
        <WhaleNotifier />
        <SettingsModal />
      </body>
    </html>
  );
}
