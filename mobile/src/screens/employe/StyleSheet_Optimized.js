import { StyleSheet } from 'react-native';

/**
 * DESIGN SYSTEM - Couleurs, espacements, ombres, etc.
 */
const COLORS = {
  // Primary
  primary: '#2563EB',
  primaryLight: '#DBEAFE',
  primaryDark: '#1E40AF',

  // Success
  success: '#10B981',
  successLight: '#D1FAE5',
  successDark: '#047857',

  // Warning
  warning: '#F59E0B',
  warningLight: '#FEF3C7',
  warningDark: '#D97706',

  // Error
  error: '#DC2626',
  errorLight: '#FEE2E2',
  errorDark: '#991B1B',

  // Info
  info: '#0891B2',
  infoLight: '#CFFAFE',
  infoDark: '#0E7490',

  // Neutral
  white: '#FFFFFF',
  gray50: '#F9FAFB',
  gray100: '#F3F4F6',
  gray200: '#E5E7EB',
  gray300: '#D1D5DB',
  gray400: '#9CA3AF',
  gray500: '#6B7280',
  gray600: '#4B5563',
  gray700: '#374151',
  gray800: '#1F2937',
  gray900: '#111827',

  // Background
  background: '#F9FAFB',
  backgroundSecondary: '#F3F4F6',
  surface: '#FFFFFF',

  // Text
  textPrimary: '#111827',
  textSecondary: '#6B7280',
  textTertiary: '#9CA3AF',

  // Borders
  border: '#E5E7EB',
  borderLight: '#F3F4F6',
};

const TYPOGRAPHY = {
  h1: {
    fontSize: 32,
    fontWeight: '700',
    lineHeight: 40,
  },
  h2: {
    fontSize: 28,
    fontWeight: '700',
    lineHeight: 36,
  },
  h3: {
    fontSize: 24,
    fontWeight: '700',
    lineHeight: 32,
  },
  h4: {
    fontSize: 20,
    fontWeight: '700',
    lineHeight: 28,
  },
  h5: {
    fontSize: 18,
    fontWeight: '600',
    lineHeight: 26,
  },
  subtitle1: {
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 24,
  },
  subtitle2: {
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
  },
  body1: {
    fontSize: 15,
    fontWeight: '400',
    lineHeight: 24,
  },
  body2: {
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 22,
  },
  caption: {
    fontSize: 12,
    fontWeight: '400',
    lineHeight: 18,
  },
  small: {
    fontSize: 11,
    fontWeight: '400',
    lineHeight: 16,
  },
  button: {
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 22,
  },
};

const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
};

const RADIUS = {
  sm: 6,
  md: 8,
  lg: 12,
  xl: 16,
  full: 9999,
};

const SHADOWS = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  xl: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 6,
  },
};

export const styles = StyleSheet.create({
  // ============================================
  // CONTAINER & LAYOUT
  // ============================================
  container: {
    flex: 1,
    backgroundColor: COLORS.backgroundSecondary,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: SPACING.xxl,
  },

  // Desktop layout
  desktopLayout: {
    flexDirection: 'row',
    gap: SPACING.lg,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
  },
  mainColumn: {
    flex: 2,
    minWidth: 400,
  },
  sideColumn: {
    flex: 1,
    minWidth: 300,
    maxWidth: 400,
  },

  // ============================================
  // CARDS & SURFACES
  // ============================================
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
    ...SHADOWS.md,
  },
  cardContent: {
    padding: SPACING.lg,
  },
  cardHeader: {
    paddingBottom: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    marginBottom: SPACING.md,
  },

  // ============================================
  // TYPOGRAPHY
  // ============================================
  pageTitle: {
    ...TYPOGRAPHY.h3,
    color: COLORS.textPrimary,
    marginBottom: SPACING.lg,
  },
  sectionTitle: {
    ...TYPOGRAPHY.h5,
    color: COLORS.textPrimary,
    marginBottom: SPACING.md,
  },
  cardTitle: {
    ...TYPOGRAPHY.h4,
    color: COLORS.textPrimary,
    marginBottom: SPACING.sm,
  },
  label: {
    ...TYPOGRAPHY.subtitle1,
    color: COLORS.textPrimary,
    marginBottom: SPACING.md,
    fontWeight: '600',
  },
  sectionLabel: {
    ...TYPOGRAPHY.subtitle1,
    color: COLORS.textPrimary,
    marginBottom: SPACING.md,
    fontWeight: '600',
  },
  text: {
    ...TYPOGRAPHY.body1,
    color: COLORS.textPrimary,
  },
  textSecondary: {
    ...TYPOGRAPHY.body2,
    color: COLORS.textSecondary,
  },
  textTertiary: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textTertiary,
  },
  required: {
    color: COLORS.error,
    fontWeight: '700',
    fontSize: 16,
  },

  // ============================================
  // SECTIONS
  // ============================================
  section: {
    marginBottom: SPACING.xl,
  },
  sectionContent: {
    gap: SPACING.md,
  },

  // ============================================
  // LEAVE TYPE SELECTOR
  // ============================================
  typeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
    marginBottom: SPACING.lg,
  },
  typeCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.sm,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 140,
    ...SHADOWS.sm,
    transition: 'all 0.2s ease',
  },
  typeCardSelected: {
    borderWidth: 3,
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primaryLight,
    ...SHADOWS.lg,
  },
  typeCardError: {
    borderColor: COLORS.error,
    backgroundColor: COLORS.errorLight,
  },
  typeCardWarning: {
    borderColor: COLORS.warning,
    backgroundColor: COLORS.warningLight,
  },
  typeIcon: {
    width: 56,
    height: 56,
    borderRadius: RADIUS.full,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    marginBottom: SPACING.sm,
  },
  typeLabel: {
    ...TYPOGRAPHY.subtitle2,
    color: COLORS.textPrimary,
    textAlign: 'center',
    marginBottom: SPACING.xs,
    fontWeight: '600',
  },
  typeDescription: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: SPACING.xs,
  },
  typeMaxDays: {
    ...TYPOGRAPHY.small,
    color: COLORS.textTertiary,
    textAlign: 'center',
    marginTop: SPACING.xs,
  },
  needsDocumentChip: {
    marginTop: SPACING.xs,
    backgroundColor: COLORS.error,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: RADIUS.sm,
  },
  needsDocumentChipText: {
    color: COLORS.white,
    fontSize: 10,
    fontWeight: '600',
  },

  // ============================================
  // BALANCE CARD
  // ============================================
  balanceCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
    marginBottom: SPACING.lg,
    ...SHADOWS.md,
  },
  balanceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    marginBottom: SPACING.md,
  },
  balanceHeaderIcon: {
    width: 44,
    height: 44,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.successLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  balanceTitle: {
    ...TYPOGRAPHY.h5,
    color: COLORS.textPrimary,
    flex: 1,
  },
  balanceGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  balanceItem: {
    flex: 1,
    minWidth: 120,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.sm,
    borderLeftWidth: 4,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.gray50,
    alignItems: 'center',
  },
  balanceItemIcon: {
    marginBottom: SPACING.xs,
  },
  balanceValue: {
    ...TYPOGRAPHY.h4,
    fontWeight: '700',
    textAlign: 'center',
    marginVertical: 4,
  },
  balanceLabel: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  balanceFooter: {
    marginTop: SPACING.md,
    paddingTop: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    alignItems: 'center',
    gap: SPACING.xs,
  },
  balanceFooterText: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },

  // ============================================
  // DATES SECTION
  // ============================================
  datesRow: {
    gap: SPACING.md,
  },
  dateColumn: {
    flex: 1,
  },
  dateLabel: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textSecondary,
    marginBottom: SPACING.xs,
    fontWeight: '500',
  },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.lg,
    minHeight: 48,
    gap: SPACING.sm,
  },
  dateButtonFocused: {
    borderColor: COLORS.primary,
    borderWidth: 2,
    backgroundColor: COLORS.primaryLight,
  },
  dateIcon: {
    color: COLORS.primary,
  },
  dateText: {
    ...TYPOGRAPHY.body1,
    color: COLORS.textPrimary,
    flex: 1,
  },
  dateArrowContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: SPACING.lg,
  },
  dateArrow: {
    color: COLORS.border,
  },

  // ============================================
  // INFO BOXES
  // ============================================
  infoBox: {
    flexDirection: 'row',
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderLeftWidth: 4,
    borderRadius: RADIUS.md,
    marginTop: SPACING.md,
    gap: SPACING.md,
  },
  infoBoxPrimary: {
    backgroundColor: COLORS.primaryLight,
    borderLeftColor: COLORS.primary,
  },
  infoBoxSuccess: {
    backgroundColor: COLORS.successLight,
    borderLeftColor: COLORS.success,
  },
  infoBoxWarning: {
    backgroundColor: COLORS.warningLight,
    borderLeftColor: COLORS.warning,
  },
  infoBoxError: {
    backgroundColor: COLORS.errorLight,
    borderLeftColor: COLORS.error,
  },
  infoBoxIcon: {
    marginTop: SPACING.xs,
  },
  infoText: {
    ...TYPOGRAPHY.body2,
    color: COLORS.textPrimary,
    flex: 1,
  },
  infoSubtext: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textSecondary,
    marginTop: SPACING.xs,
  },
  durationContent: {
    gap: SPACING.xs,
  },
  durationValue: {
    fontWeight: '700',
    color: COLORS.primary,
  },

  // ============================================
  // WARNING BOXES
  // ============================================
  warningBox: {
    flexDirection: 'row',
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderLeftWidth: 4,
    borderRadius: RADIUS.md,
  },
  warningItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderLeftWidth: 4,
    borderRadius: RADIUS.md,
    marginBottom: SPACING.xs,
    gap: SPACING.sm,
  },
  warningContent: {
    flex: 1,
  },
  warningText: {
    ...TYPOGRAPHY.small,
    color: COLORS.textPrimary,
  },

  // ============================================
  // REASON INPUT
  // ============================================
  reasonInput: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.md,
    minHeight: 100,
    color: COLORS.textPrimary,
    fontSize: 15,
  },
  reasonInputFocused: {
    borderColor: COLORS.primary,
    borderWidth: 2,
    backgroundColor: COLORS.primaryLight,
  },
  characterCountContainer: {
    marginTop: SPACING.sm,
    alignItems: 'flex-end',
    paddingRight: SPACING.md,
  },
  characterCount: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textTertiary,
  },
  characterCountWarning: {
    color: COLORS.error,
    fontWeight: '600',
  },

  // ============================================
  // DOCUMENT SECTION
  // ============================================
  documentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
    gap: SPACING.sm,
  },
  requiredChip: {
    backgroundColor: COLORS.error,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: RADIUS.sm,
  },
  requiredChipText: {
    color: COLORS.white,
    fontSize: 11,
    fontWeight: '600',
  },
  uploadButton: {
    paddingVertical: SPACING.xl,
    paddingHorizontal: SPACING.md,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    borderWidth: 2,
    borderColor: COLORS.border,
    borderStyle: 'dashed',
    alignItems: 'center',
    gap: SPACING.md,
    minHeight: 140,
    justifyContent: 'center',
  },
  uploadButtonActive: {
    backgroundColor: COLORS.primaryLight,
    borderColor: COLORS.primary,
  },
  uploadIcon: {
    color: COLORS.primary,
  },
  uploadText: {
    ...TYPOGRAPHY.subtitle2,
    color: COLORS.primary,
    fontWeight: '600',
    textAlign: 'center',
  },
  uploadHint: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textTertiary,
    textAlign: 'center',
  },
  uploadingContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: SPACING.lg,
    backgroundColor: COLORS.gray50,
    borderRadius: RADIUS.lg,
    gap: SPACING.md,
  },
  uploadingText: {
    ...TYPOGRAPHY.body2,
    color: COLORS.primary,
    fontWeight: '500',
  },
  documentPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.md,
    backgroundColor: COLORS.gray50,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: SPACING.md,
  },
  documentIcon: {
    width: 52,
    height: 52,
    borderRadius: RADIUS.full,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.infoLight,
  },
  documentInfo: {
    flex: 1,
    gap: SPACING.xs,
  },
  documentName: {
    ...TYPOGRAPHY.body2,
    color: COLORS.textPrimary,
    fontWeight: '600',
  },
  documentMeta: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textSecondary,
  },
  removeDocButton: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.full,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.errorLight,
  },

  // ============================================
  // ACTION BUTTONS
  // ============================================
  validatingContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: SPACING.md,
    backgroundColor: COLORS.successLight,
    borderRadius: RADIUS.lg,
    gap: SPACING.md,
  },
  validatingText: {
    ...TYPOGRAPHY.body2,
    color: COLORS.success,
    fontWeight: '600',
  },
  submitButton: {
    borderRadius: RADIUS.lg,
    paddingVertical: SPACING.sm,
    backgroundColor: COLORS.primary,
    minHeight: 48,
  },
  submitButtonDisabled: {
    backgroundColor: COLORS.gray400,
    opacity: 0.6,
  },
  submitButtonLabel: {
    ...TYPOGRAPHY.button,
    color: COLORS.white,
  },
  resetButton: {
    borderRadius: RADIUS.lg,
    marginTop: SPACING.md,
    borderColor: COLORS.border,
    minHeight: 48,
  },
  resetButtonLabel: {
    ...TYPOGRAPHY.button,
    color: COLORS.textPrimary,
  },
  disclaimer: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: SPACING.lg,
    fontStyle: 'italic',
    paddingHorizontal: SPACING.md,
  },

  // ============================================
  // HISTORY CARD
  // ============================================
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
    paddingBottom: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  historyTitle: {
    ...TYPOGRAPHY.h5,
    color: COLORS.textPrimary,
  },
  seeAllText: {
    ...TYPOGRAPHY.body2,
    color: COLORS.primary,
    fontWeight: '600',
  },
  historyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    gap: SPACING.md,
  },
  historyItemLast: {
    borderBottomWidth: 0,
  },
  historyIcon: {
    width: 44,
    height: 44,
    borderRadius: RADIUS.full,
    justifyContent: 'center',
    alignItems: 'center',
  },
  historyContent: {
    flex: 1,
    gap: SPACING.xs,
  },
  historyType: {
    ...TYPOGRAPHY.body2,
    color: COLORS.textPrimary,
    fontWeight: '600',
  },
  historyDates: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textSecondary,
  },
  historyDuration: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textTertiary,
  },
  historyStatus: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: RADIUS.sm,
    minWidth: 80,
    alignItems: 'center',
  },
  historyStatusText: {
    ...TYPOGRAPHY.caption,
    color: COLORS.white,
    fontWeight: '600',
    textAlign: 'center',
  },

  // ============================================
  // LOADING STATES
  // ============================================
  loadingOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.backgroundSecondary,
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: SPACING.xl,
    paddingHorizontal: SPACING.lg,
    gap: SPACING.md,
  },
  loadingText: {
    ...TYPOGRAPHY.body2,
    color: COLORS.textSecondary,
  },
  loadingBalanceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.lg,
    gap: SPACING.md,
  },
  loadingBalanceText: {
    ...TYPOGRAPHY.body2,
    color: COLORS.textSecondary,
  },
  loadingHistoryContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.lg,
    gap: SPACING.md,
  },
  loadingHistoryText: {
    ...TYPOGRAPHY.body2,
    color: COLORS.textSecondary,
  },

  // ============================================
  // DIALOGS & MODALS
  // ============================================
  submittingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  submittingContainer: {
    backgroundColor: COLORS.primary,
    paddingVertical: SPACING.xl,
    paddingHorizontal: SPACING.xl,
    borderRadius: RADIUS.lg,
    alignItems: 'center',
    minWidth: 200,
    ...SHADOWS.xl,
    gap: SPACING.md,
  },
  submittingText: {
    ...TYPOGRAPHY.body2,
    color: COLORS.white,
    fontWeight: '600',
    textAlign: 'center',
  },
  submittingProgress: {
    width: 150,
    height: 4,
    borderRadius: RADIUS.sm,
  },

  // ============================================
  // VALIDATION DIALOG
  // ============================================
  validationError: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.sm,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    backgroundColor: COLORS.errorLight,
    borderRadius: RADIUS.md,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.error,
    gap: SPACING.md,
  },
  validationErrorText: {
    ...TYPOGRAPHY.body2,
    color: COLORS.textPrimary,
    flex: 1,
  },

  // ============================================
  // REFRESH CONTROL
  // ============================================
  refreshControl: {
    tintColor: COLORS.primary,
  },

  // ============================================
  // EMPTY STATES
  // ============================================
  emptyContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: SPACING.xxxl,
    paddingHorizontal: SPACING.lg,
    gap: SPACING.md,
  },
  emptyIcon: {
    fontSize: 48,
    color: COLORS.textTertiary,
  },
  emptyText: {
    ...TYPOGRAPHY.body2,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },

  // ============================================
  // ERROR STATES
  // ============================================
  errorContainer: {
    paddingVertical: SPACING.lg,
    paddingHorizontal: SPACING.md,
    backgroundColor: COLORS.errorLight,
    borderRadius: RADIUS.lg,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.error,
    gap: SPACING.sm,
  },
  errorTitle: {
    ...TYPOGRAPHY.subtitle2,
    color: COLORS.error,
    fontWeight: '600',
  },
  errorText: {
    ...TYPOGRAPHY.body2,
    color: COLORS.error,
  },

  // ============================================
  // SUCCESS STATES
  // ============================================
  successContainer: {
    paddingVertical: SPACING.lg,
    paddingHorizontal: SPACING.md,
    backgroundColor: COLORS.successLight,
    borderRadius: RADIUS.lg,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.success,
    gap: SPACING.sm,
  },
  successTitle: {
    ...TYPOGRAPHY.subtitle2,
    color: COLORS.success,
    fontWeight: '600',
  },
  successText: {
    ...TYPOGRAPHY.body2,
    color: COLORS.success,
  },

  // ============================================
  // SEPARATORS
  // ============================================
  divider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: SPACING.md,
  },
  dividerLight: {
    height: 1,
    backgroundColor: COLORS.borderLight,
    marginVertical: SPACING.sm,
  },

  // ============================================
  // RESPONSIVE HELPERS
  // ============================================
  flex: {
    flex: 1,
  },
  row: {
    flexDirection: 'row',
  },
  column: {
    flexDirection: 'column',
  },
  center: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  spaceBetween: {
    justifyContent: 'space-between',
  },
  spaceAround: {
    justifyContent: 'space-around',
  },
  alignItemsCenter: {
    alignItems: 'center',
  },
});

// Export color scheme for dynamic theming
export const theme = {
  colors: COLORS,
  typography: TYPOGRAPHY,
  spacing: SPACING,
  radius: RADIUS,
  shadows: SHADOWS,
};

export default styles;