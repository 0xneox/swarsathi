import React, { useCallback, useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ActionButton } from '../components/ActionButton';
import { AppBottomNav } from '../components/AppBottomNav';
import {
  ISL_SIGN_ENTRIES,
  type IslSignEntry,
  type IslValidationStatus,
} from '../data/islSigns';
import { PHRASE_CATEGORIES } from '../data/phrases';
import { useTheme } from '../providers/ThemeProvider';
import { getPosePipelineStatus } from '../services/isl';
import { useAppStore } from '../store/appStore';

type StatusFilter = 'all' | 'community-checked' | 'unverified';

/**
 * Indian Sign Language Resource Library (vision.md §2E).
 *
 * Scoped strictly to verified visual cards, community review workflow,
 * and honest reporting. Camera-based sign-to-text claims are explicitly excluded.
 */
export default function IslScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const preferences = useAppStore((state) => state.preferences);
  const speakMessage = useAppStore((state) => state.speakMessage);
  const appendComposeText = useAppStore((state) => state.appendComposeText);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [detailEntry, setDetailEntry] = useState<IslSignEntry | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const poseStatus = useMemo(() => getPosePipelineStatus(), []);

  // Filter signs by query, category, and validation status
  const filteredSigns = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return ISL_SIGN_ENTRIES.filter((entry) => {
      // Category filter
      if (selectedCategory !== 'all' && entry.category !== selectedCategory) {
        return false;
      }
      // Status filter
      if (statusFilter !== 'all' && entry.validationStatus !== statusFilter) {
        return false;
      }
      // Search query
      if (q.length > 0) {
        const titleMatch = entry.title.toLowerCase().includes(q);
        const guideMatch = entry.movementGuide.toLowerCase().includes(q);
        return titleMatch || guideMatch;
      }
      return true;
    });
  }, [searchQuery, selectedCategory, statusFilter]);

  const handleSpeak = useCallback(
    (text: string) => {
      void speakMessage(text, preferences.language, 'phrase');
    },
    [speakMessage, preferences.language]
  );

  const handleAddToCompose = useCallback(
    (text: string) => {
      appendComposeText(text, preferences.language);
      setToastMessage(`Added "${text}" to Compose`);
      setTimeout(() => setToastMessage(null), 3000);
    },
    [appendComposeText, preferences.language]
  );

  return (
    <View style={[styles.flex, { backgroundColor: theme.colors.background }]}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          {
            paddingBottom: Math.max(insets.bottom, 16) + 72,
          },
        ]}
      >
        {/* Header */}
        <View style={styles.headerBlock}>
          <Text
            accessibilityRole="header"
            style={{
              color: theme.colors.text,
              fontSize: theme.fontSizes.title * theme.fontScale,
              fontWeight: '800',
            }}
          >
            Indian Sign Language
          </Text>
          <Text
            style={{
              color: theme.colors.textMuted,
              fontSize: theme.fontSizes.body * theme.fontScale,
            }}
          >
            Visual communication resource cards created with Deaf community partners.
          </Text>
        </View>

        {/* Ethical Notice / Vision §2E Disclosure */}
        <View
          testID="isl-ethical-disclosure"
          style={[
            styles.noticeCard,
            {
              backgroundColor: theme.colors.surfaceMuted,
              borderColor: theme.colors.border,
              borderRadius: theme.radius.md,
            },
          ]}
        >
          <Text
            style={{
              color: theme.colors.text,
              fontSize: theme.fontSizes.caption * theme.fontScale,
              fontWeight: '800',
              marginBottom: 2,
            }}
          >
            Community validation & research ethics
          </Text>
          <Text
            style={{
              color: theme.colors.textMuted,
              fontSize: (theme.fontSizes.caption - 1) * theme.fontScale,
              lineHeight: 16,
            }}
          >
            ISL possesses its own rich grammar, spatial structure, and regional variations.
            SwarSathi does not market small gesture classifiers as translation. Every asset is
            reviewed with native signers.
          </Text>
        </View>

        {toastMessage ? (
          <View
            accessibilityLiveRegion="polite"
            style={[
              styles.toast,
              {
                backgroundColor: theme.colors.primary,
                borderRadius: theme.radius.md,
              },
            ]}
          >
            <Text
              style={{
                color: '#FFFFFF',
                fontSize: theme.fontSizes.body * theme.fontScale,
                fontWeight: '700',
              }}
            >
              {toastMessage}
            </Text>
          </View>
        ) : null}

        {/* Search Bar */}
        <TextInput
          testID="isl-search-input"
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search signs by word or phrase…"
          placeholderTextColor={theme.colors.textMuted}
          style={[
            styles.searchInput,
            {
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.border,
              borderWidth: theme.mode === 'high-contrast' ? 2 : 1,
              borderRadius: theme.radius.md,
              color: theme.colors.text,
              fontSize: theme.fontSizes.body * theme.fontScale,
              minHeight: theme.minTouchTarget,
              paddingHorizontal: theme.spacing.md,
            },
          ]}
        />

        {/* Category Filter Chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8 }}
        >
          <Pressable
            testID="isl-category-all"
            onPress={() => setSelectedCategory('all')}
            accessibilityRole="button"
            accessibilityState={{ selected: selectedCategory === 'all' }}
            style={[
              styles.filterChip,
              {
                backgroundColor:
                  selectedCategory === 'all'
                    ? theme.colors.primary
                    : theme.colors.surface,
                borderColor: theme.colors.border,
                borderRadius: theme.radius.pill,
              },
            ]}
          >
            <Text
              style={{
                color: selectedCategory === 'all' ? '#FFFFFF' : theme.colors.text,
                fontSize: theme.fontSizes.caption * theme.fontScale,
                fontWeight: '700',
              }}
            >
              All Categories
            </Text>
          </Pressable>
          {PHRASE_CATEGORIES.map((cat) => {
            const isSelected = selectedCategory === cat.id;
            return (
              <Pressable
                key={cat.id}
                testID={`isl-category-${cat.id}`}
                onPress={() => setSelectedCategory(cat.id)}
                accessibilityRole="button"
                accessibilityState={{ selected: isSelected }}
                style={[
                  styles.filterChip,
                  {
                    backgroundColor: isSelected
                      ? theme.colors.primary
                      : theme.colors.surface,
                    borderColor: theme.colors.border,
                    borderRadius: theme.radius.pill,
                  },
                ]}
              >
                <Text
                  style={{
                    color: isSelected ? '#FFFFFF' : theme.colors.text,
                    fontSize: theme.fontSizes.caption * theme.fontScale,
                    fontWeight: '700',
                  }}
                >
                  {cat.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* Validation Status Filter Chips */}
        <View style={styles.statusFilterRow}>
          <Pressable
            testID="isl-filter-all"
            onPress={() => setStatusFilter('all')}
            style={[
              styles.statusChip,
              {
                backgroundColor:
                  statusFilter === 'all'
                    ? theme.colors.surfaceMuted
                    : theme.colors.background,
                borderColor: theme.colors.border,
                borderRadius: theme.radius.md,
              },
            ]}
          >
            <Text
              style={{
                color: theme.colors.text,
                fontSize: theme.fontSizes.caption * theme.fontScale,
                fontWeight: statusFilter === 'all' ? '800' : '600',
              }}
            >
              All ({ISL_SIGN_ENTRIES.length})
            </Text>
          </Pressable>
          <Pressable
            testID="isl-filter-community"
            onPress={() => setStatusFilter('community-checked')}
            style={[
              styles.statusChip,
              {
                backgroundColor:
                  statusFilter === 'community-checked'
                    ? theme.colors.surfaceMuted
                    : theme.colors.background,
                borderColor: theme.colors.border,
                borderRadius: theme.radius.md,
              },
            ]}
          >
            <Text
              style={{
                color: theme.colors.primary,
                fontSize: theme.fontSizes.caption * theme.fontScale,
                fontWeight: statusFilter === 'community-checked' ? '800' : '600',
              }}
            >
              ✓ Community-checked
            </Text>
          </Pressable>
          <Pressable
            testID="isl-filter-pending"
            onPress={() => setStatusFilter('unverified')}
            style={[
              styles.statusChip,
              {
                backgroundColor:
                  statusFilter === 'unverified'
                    ? theme.colors.surfaceMuted
                    : theme.colors.background,
                borderColor: theme.colors.border,
                borderRadius: theme.radius.md,
              },
            ]}
          >
            <Text
              style={{
                color: theme.colors.textMuted,
                fontSize: theme.fontSizes.caption * theme.fontScale,
                fontWeight: statusFilter === 'unverified' ? '800' : '600',
              }}
            >
              Pending validation
            </Text>
          </Pressable>
        </View>

        {/* Sign Cards List */}
        <View style={{ gap: theme.spacing.md }}>
          {filteredSigns.length === 0 ? (
            <View style={[styles.emptyContainer, { borderColor: theme.colors.border }]}>
              <Text
                style={{
                  color: theme.colors.textMuted,
                  fontSize: theme.fontSizes.body * theme.fontScale,
                }}
              >
                No signs match your search or filter.
              </Text>
            </View>
          ) : (
            filteredSigns.map((entry) => {
              const hasAsset = entry.asset && entry.asset.type !== 'placeholder';

              return (
                <View
                  key={entry.id}
                  testID={`isl-sign-card-${entry.id}`}
                  style={[
                    styles.signCard,
                    {
                      backgroundColor: theme.colors.surface,
                      borderColor: theme.colors.border,
                      borderWidth: theme.mode === 'high-contrast' ? 2 : 1,
                      borderRadius: theme.radius.lg,
                      padding: theme.spacing.md,
                      gap: theme.spacing.sm,
                    },
                  ]}
                >
                  {/* Card Title & Category */}
                  <View style={styles.cardHeaderRow}>
                    <Text
                      testID={`isl-sign-title-${entry.id}`}
                      style={{
                        flex: 1,
                        color: theme.colors.text,
                        fontSize: theme.fontSizes.label * theme.fontScale,
                        fontWeight: '800',
                      }}
                    >
                      {entry.title}
                    </Text>
                    <View
                      testID={`isl-sign-badge-${entry.id}`}
                      style={[
                        styles.badge,
                        {
                          backgroundColor:
                            entry.validationStatus === 'community-checked'
                              ? '#EBF5FF'
                              : entry.validationStatus === 'expert-reviewed'
                              ? '#E6F4EA'
                              : '#FFF8E1',
                          borderColor:
                            entry.validationStatus === 'community-checked'
                              ? '#3B82F6'
                              : entry.validationStatus === 'expert-reviewed'
                              ? '#10B981'
                              : '#F59E0B',
                        },
                      ]}
                    >
                      <Text
                        style={{
                          color:
                            entry.validationStatus === 'community-checked'
                              ? '#1D4ED8'
                              : entry.validationStatus === 'expert-reviewed'
                              ? '#065F46'
                              : '#92400E',
                          fontSize: (theme.fontSizes.caption - 1) * theme.fontScale,
                          fontWeight: '800',
                        }}
                      >
                        {entry.validationStatus === 'community-checked'
                          ? 'Community Checked'
                          : entry.validationStatus === 'expert-reviewed'
                          ? 'Expert Reviewed'
                          : 'Pending Community Validation'}
                      </Text>
                    </View>
                  </View>

                  {/* Visual Asset or "Sign Resource Pending" placeholder */}
                  {hasAsset ? (
                    <View
                      testID={`isl-sign-asset-${entry.id}`}
                      style={[
                        styles.assetBox,
                        {
                          backgroundColor: theme.colors.background,
                          borderColor: theme.colors.border,
                        },
                      ]}
                    >
                      <View style={styles.assetVisualPlaceholder}>
                        <Text style={{ fontSize: 32 }}>🤟</Text>
                        <Text
                          style={{
                            color: theme.colors.text,
                            fontSize: theme.fontSizes.caption * theme.fontScale,
                            fontWeight: '700',
                          }}
                        >
                          ISL Sign Illustration
                        </Text>
                      </View>
                      {entry.asset?.attribution ? (
                        <Text
                          style={{
                            color: theme.colors.textMuted,
                            fontSize: (theme.fontSizes.caption - 2) * theme.fontScale,
                          }}
                        >
                          Source: {entry.asset.attribution} ({entry.asset.license ?? 'CC'})
                        </Text>
                      ) : null}
                    </View>
                  ) : (
                    <View
                      testID={`isl-sign-pending-${entry.id}`}
                      style={[
                        styles.pendingBox,
                        {
                          backgroundColor: theme.colors.surfaceMuted,
                          borderColor: theme.colors.border,
                        },
                      ]}
                    >
                      <Text
                        style={{
                          color: theme.colors.text,
                          fontSize: theme.fontSizes.caption * theme.fontScale,
                          fontWeight: '800',
                        }}
                      >
                        Sign resource pending
                      </Text>
                      <Text
                        style={{
                          color: theme.colors.textMuted,
                          fontSize: (theme.fontSizes.caption - 1) * theme.fontScale,
                        }}
                      >
                        Validated visual asset awaiting native signer review.
                      </Text>
                    </View>
                  )}

                  {/* Movement Guide */}
                  <View style={{ gap: 2 }}>
                    <Text
                      style={{
                        color: theme.colors.textMuted,
                        fontSize: (theme.fontSizes.caption - 1) * theme.fontScale,
                        fontWeight: '700',
                      }}
                    >
                      HOW TO SIGN:
                    </Text>
                    <Text
                      testID={`isl-sign-desc-${entry.id}`}
                      style={{
                        color: theme.colors.text,
                        fontSize: theme.fontSizes.caption * theme.fontScale,
                        lineHeight: 18,
                      }}
                    >
                      {entry.movementGuide}
                    </Text>
                  </View>

                  {/* Regional Variations if present */}
                  {entry.regionalVariations && entry.regionalVariations.length > 0 ? (
                    <View style={{ gap: 2 }}>
                      <Text
                        style={{
                          color: theme.colors.textMuted,
                          fontSize: (theme.fontSizes.caption - 1) * theme.fontScale,
                          fontWeight: '700',
                        }}
                      >
                        REGIONAL VARIATIONS:
                      </Text>
                      {entry.regionalVariations.map((v, i) => (
                        <Text
                          key={i}
                          style={{
                            color: theme.colors.textMuted,
                            fontSize: (theme.fontSizes.caption - 1) * theme.fontScale,
                          }}
                        >
                          • {v.region}: {v.description}
                        </Text>
                      ))}
                    </View>
                  ) : null}

                  {/* Card Actions */}
                  <View style={[styles.actionRow, { gap: theme.spacing.sm }]}>
                    <View style={styles.flex}>
                      <ActionButton
                        testID={`isl-speak-${entry.id}`}
                        label="Speak"
                        hint="Says this phrase out loud."
                        onPress={() => handleSpeak(entry.title)}
                      />
                    </View>
                    <View style={styles.flex}>
                      <ActionButton
                        testID={`isl-add-draft-${entry.id}`}
                        label="Add to draft"
                        hint="Adds this phrase to Compose."
                        variant="secondary"
                        onPress={() => handleAddToCompose(entry.title)}
                      />
                    </View>
                    <View style={styles.flex}>
                      <ActionButton
                        testID={`isl-details-${entry.id}`}
                        label="Details"
                        hint="Shows validation and regional information."
                        variant="secondary"
                        onPress={() => setDetailEntry(entry)}
                      />
                    </View>
                  </View>
                </View>
              );
            })
          )}
        </View>

        {/* Experimental Pose Pipeline Notice (Sprint 8 Requirement 3) */}
        <View
          testID="isl-experimental-pose-section"
          style={[
            styles.experimentalCard,
            {
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.border,
              borderWidth: 1,
              borderRadius: theme.radius.lg,
              padding: theme.spacing.md,
              gap: theme.spacing.xs,
            },
          ]}
        >
          <Text
            style={{
              color: theme.colors.text,
              fontSize: theme.fontSizes.label * theme.fontScale,
              fontWeight: '800',
            }}
          >
            Pose Recognition Research Track
          </Text>
          <Text
            testID="isl-pose-status"
            style={{
              color: theme.colors.textMuted,
              fontSize: theme.fontSizes.caption * theme.fontScale,
              fontWeight: '700',
            }}
          >
            Status: {poseStatus.status.toUpperCase()} (Claim Translation: FALSE)
          </Text>
          <Text
            testID="isl-pose-disclaimer"
            style={{
              color: theme.colors.textMuted,
              fontSize: (theme.fontSizes.caption - 1) * theme.fontScale,
              lineHeight: 16,
            }}
          >
            {poseStatus.disclaimer}
          </Text>
        </View>
      </ScrollView>

      {/* Validation & Details Modal */}
      <Modal
        visible={detailEntry !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setDetailEntry(null)}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.modalCard,
              {
                backgroundColor: theme.colors.background,
                maxHeight: '80%',
              },
            ]}
          >
            {detailEntry ? (
              <ScrollView style={{ gap: theme.spacing.md }}>
                <Text
                  accessibilityRole="header"
                  style={{
                    color: theme.colors.text,
                    fontSize: theme.fontSizes.title * theme.fontScale,
                    fontWeight: '800',
                    marginBottom: 4,
                  }}
                >
                  {detailEntry.title}
                </Text>

                <View
                  style={[
                    styles.badge,
                    {
                      alignSelf: 'flex-start',
                      backgroundColor:
                        detailEntry.validationStatus === 'community-checked'
                          ? '#EBF5FF'
                          : '#FFF8E1',
                      borderColor:
                        detailEntry.validationStatus === 'community-checked'
                          ? '#3B82F6'
                          : '#F59E0B',
                      marginBottom: 8,
                    },
                  ]}
                >
                  <Text
                    style={{
                      color:
                        detailEntry.validationStatus === 'community-checked'
                          ? '#1D4ED8'
                          : '#92400E',
                      fontSize: theme.fontSizes.caption * theme.fontScale,
                      fontWeight: '800',
                    }}
                  >
                    Status: {detailEntry.validationStatus}
                  </Text>
                </View>

                <View style={{ gap: 4, marginBottom: 8 }}>
                  <Text
                    style={{
                      color: theme.colors.textMuted,
                      fontSize: theme.fontSizes.caption * theme.fontScale,
                      fontWeight: '700',
                    }}
                  >
                    COMMUNITY VALIDATION NOTE:
                  </Text>
                  <Text
                    testID="isl-modal-validation-note"
                    style={{
                      color: theme.colors.text,
                      fontSize: theme.fontSizes.body * theme.fontScale,
                      lineHeight: 20,
                    }}
                  >
                    {detailEntry.validationNote}
                  </Text>
                </View>

                <View style={{ gap: 4, marginBottom: 8 }}>
                  <Text
                    style={{
                      color: theme.colors.textMuted,
                      fontSize: theme.fontSizes.caption * theme.fontScale,
                      fontWeight: '700',
                    }}
                  >
                    MOVEMENT GUIDE:
                  </Text>
                  <Text
                    style={{
                      color: theme.colors.text,
                      fontSize: theme.fontSizes.body * theme.fontScale,
                      lineHeight: 20,
                    }}
                  >
                    {detailEntry.movementGuide}
                  </Text>
                </View>

                {detailEntry.reviewedBy ? (
                  <Text
                    style={{
                      color: theme.colors.textMuted,
                      fontSize: theme.fontSizes.caption * theme.fontScale,
                    }}
                  >
                    Reviewed by: {detailEntry.reviewedBy}
                  </Text>
                ) : null}
              </ScrollView>
            ) : null}

            <ActionButton
              testID="isl-modal-close"
              label="Close"
              hint="Closes the sign details modal."
              onPress={() => setDetailEntry(null)}
            />
          </View>
        </View>
      </Modal>

      <AppBottomNav activeTab="home" />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  content: {
    padding: 16,
    gap: 16,
  },
  headerBlock: {
    gap: 4,
  },
  noticeCard: {
    padding: 12,
    borderWidth: 1,
  },
  toast: {
    padding: 12,
    alignItems: 'center',
  },
  searchInput: {
    minHeight: 48,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderWidth: 1,
  },
  statusFilterRow: {
    flexDirection: 'row',
    gap: 8,
  },
  statusChip: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyContainer: {
    padding: 24,
    borderWidth: 1,
    borderRadius: 8,
    alignItems: 'center',
  },
  signCard: {
    borderWidth: 1,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderRadius: 6,
  },
  assetBox: {
    padding: 12,
    borderWidth: 1,
    borderRadius: 8,
    alignItems: 'center',
    gap: 6,
  },
  assetVisualPlaceholder: {
    alignItems: 'center',
    gap: 4,
  },
  pendingBox: {
    padding: 12,
    borderWidth: 1,
    borderRadius: 8,
    borderStyle: 'dashed',
    gap: 2,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    marginTop: 4,
  },
  experimentalCard: {
    marginTop: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 16,
    gap: 12,
  },
});

