import { type Href, usePathname, useRouter } from 'expo-router';
import { Modal, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

type AppSidebarProps = {
  visible: boolean;
  onClose: () => void;
};

const menuItems: { label: string; href: Href; icon: string }[] = [
  { label: 'Dashboard', href: '/', icon: '⌘' },
  { label: 'Expenses', href: '/expenses', icon: '▧' },
  { label: 'Budgets', href: '/budgets', icon: '◔' },
  { label: 'Savings', href: '/savings', icon: '◈' },
  { label: 'Categories', href: '/categories', icon: '◇' },
  { label: 'Custom Fields', href: '/custom-fields', icon: '☷' },
  { label: 'Reports', href: '/reports', icon: '↗' },
  { label: 'Settings', href: '/settings', icon: '⚙' },
];

export function AppSidebar({ visible, onClose }: AppSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const drawerWidth = Math.min(width * 0.78, 360);

  const navigate = (href: Href) => {
    onClose();
    router.push(href);
  };

  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.modalRoot}>
        <Pressable accessibilityLabel="Close navigation" style={styles.scrim} onPress={onClose} />
        <View style={[styles.drawer, { width: drawerWidth }]}>
          <View style={styles.brandRow}>
            <View style={styles.brandIcon}><Text style={styles.brandIconText}>▧</Text></View>
            <Text style={styles.brandTitle}>SAVE Finance</Text>
            <Pressable accessibilityLabel="Close navigation" style={styles.closeButton} onPress={onClose}>
              <Text style={styles.closeText}>×</Text>
            </Pressable>
          </View>

          <View style={styles.divider} />
          <View style={styles.menu}>
            {menuItems.map((item) => {
              const selected = item.href === '/' ? pathname === '/' : pathname === item.href;
              return (
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  key={item.label}
                  onPress={() => navigate(item.href)}
                  style={({ pressed }) => [
                    styles.menuItem,
                    selected && styles.menuItemSelected,
                    pressed && styles.menuItemPressed,
                  ]}>
                  <Text style={[styles.menuIcon, selected && styles.menuTextSelected]}>{item.icon}</Text>
                  <Text style={[styles.menuText, selected && styles.menuTextSelected]}>{item.label}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalRoot: { flex: 1, flexDirection: 'row' },
  scrim: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0, 4, 12, 0.76)' },
  drawer: { height: '100%', backgroundColor: '#0d172d', borderRightWidth: 1, borderRightColor: '#1a2943', shadowColor: '#000', shadowOpacity: 0.45, shadowRadius: 18, shadowOffset: { width: 8, height: 0 }, elevation: 20 },
  brandRow: { minHeight: 112, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 17, paddingTop: 22 },
  brandIcon: { width: 48, height: 48, borderRadius: 12, backgroundColor: '#61a9f8', alignItems: 'center', justifyContent: 'center' },
  brandIconText: { color: '#07111f', fontSize: 25, fontWeight: '800' },
  brandTitle: { color: '#f1f5fb', fontSize: 18, fontWeight: '800', marginLeft: 13, flex: 1 },
  closeButton: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  closeText: { color: '#91a0ba', fontSize: 34, fontWeight: '300', lineHeight: 36 },
  divider: { height: 1, backgroundColor: '#1a2943' },
  menu: { paddingHorizontal: 10, paddingTop: 21, gap: 5 },
  menuItem: { height: 52, borderRadius: 10, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18 },
  menuItemSelected: { backgroundColor: '#61a9f8' },
  menuItemPressed: { opacity: 0.78 },
  menuIcon: { width: 38, color: '#8d9bb4', fontSize: 23, fontWeight: '600' },
  menuText: { color: '#8d9bb4', fontSize: 17, fontWeight: '700' },
  menuTextSelected: { color: '#081221' },
});
