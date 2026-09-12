import { redirect } from 'next/navigation'

// Notifications became a tab of the news feed, the way City Goo models it.
// The bell in the headers and Home's top bar still point here, so this keeps
// those links landing on the right tab rather than breaking them.
export default function NotificationsPage() {
	redirect('/news?tab=notifications')
}
