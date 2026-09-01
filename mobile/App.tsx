import { useEffect, useMemo, useState } from 'react';
import {
  Button,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  createPurchase,
  createRedemption,
  getCustomerBalance,
  getCustomerHistory,
} from './src/api/loyaltyApi';
import type { CustomerBalance, HistoryEntry } from './src/types/loyalty';

const CUSTOMERS = [
  { id: '11111111-1111-4111-8111-111111111111', name: 'Customer One' },
  { id: '22222222-2222-4222-8222-222222222222', name: 'Customer Two' },
  { id: '33333333-3333-4333-8333-333333333333', name: 'Customer Three' },
] as const;

const REWARDS = [
  { id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', name: 'Free Coffee', pointsCost: 75 },
  { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', name: 'Silver Reward', pointsCost: 150 },
  { id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', name: 'Gold Reward', pointsCost: 300 },
] as const;

type ConnectionStatus = 'Not connected' | 'Connecting...' | 'Connected' | 'Connection failed';

function normalizeServerUrl(rawValue: string): string {
  const trimmed = rawValue.trim();
  if (!trimmed) {
    return '';
  }

  const withoutTrailingSlash = trimmed.replace(/\/+$/, '');

  if (/^https?:\/\//i.test(withoutTrailingSlash)) {
    return withoutTrailingSlash;
  }

  return `http://${withoutTrailingSlash}`;
}

export default function App() {
  const [serverInput, setServerInput] = useState('');
  const [serverUrl, setServerUrl] = useState('');
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('Not connected');
  const [statusMessage, setStatusMessage] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>(CUSTOMERS[0].id);
  const [balance, setBalance] = useState<CustomerBalance | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [purchaseAmount, setPurchaseAmount] = useState('');
  const [isLoadingCustomer, setIsLoadingCustomer] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [isRedeeming, setIsRedeeming] = useState(false);

  const selectedCustomer =
    CUSTOMERS.find((customer) => customer.id === selectedCustomerId) ?? CUSTOMERS[0];

  const loadCustomerData = async (url: string, customerId: string) => {
    setIsLoadingCustomer(true);
    setStatusMessage('');

    try {
      const [balanceResponse, historyResponse] = await Promise.all([
        getCustomerBalance(url, customerId),
        getCustomerHistory(url, customerId),
      ]);

      setBalance(balanceResponse);
      setHistory(historyResponse.entries);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to connect to backend';
      setConnectionStatus('Connection failed');
      setBalance(null);
      setHistory([]);
      setStatusMessage(message);
    } finally {
      setIsLoadingCustomer(false);
    }
  };

  useEffect(() => {
    if (connectionStatus === 'Connected' && serverUrl) {
      void loadCustomerData(serverUrl, selectedCustomerId);
    }
  }, [connectionStatus, selectedCustomerId, serverUrl]);

  const handleConnect = async () => {
    const raw = serverInput.trim();
    if (!raw) {
      setConnectionStatus('Connection failed');
      setStatusMessage('Please enter a backend server address.');
      return;
    }

    const normalizedUrl = normalizeServerUrl(raw);
    setIsConnecting(true);
    setConnectionStatus('Connecting...');
    setStatusMessage('');

    try {
      const balanceResponse = await getCustomerBalance(normalizedUrl, selectedCustomerId);
      const historyResponse = await getCustomerHistory(normalizedUrl, selectedCustomerId);

      setServerUrl(normalizedUrl);
      setBalance(balanceResponse);
      setHistory(historyResponse.entries);
      setConnectionStatus('Connected');
      setStatusMessage('Connected');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to connect to backend';
      setServerUrl('');
      setConnectionStatus('Connection failed');
      setBalance(null);
      setHistory([]);
      setStatusMessage(message || 'Unable to connect to backend');
    } finally {
      setIsConnecting(false);
    }
  };

  const handlePurchase = async () => {
    if (!serverUrl || connectionStatus !== 'Connected') {
      setStatusMessage('Connect to the backend before making a purchase.');
      return;
    }

    const value = Number(purchaseAmount);
    if (!purchaseAmount.trim() || !Number.isInteger(value) || value <= 0) {
      setStatusMessage('Enter a valid PKR amount greater than 0.');
      return;
    }

    setIsPurchasing(true);
    setStatusMessage('');

    try {
      const result = await createPurchase(serverUrl, selectedCustomerId, value);
      setStatusMessage(`Purchase successful. Earned ${result.pointsEarned} points.`);
      setPurchaseAmount('');
      await loadCustomerData(serverUrl, selectedCustomerId);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to process purchase.';
      setStatusMessage(message);
    } finally {
      setIsPurchasing(false);
    }
  };

  const handleRedemption = async (rewardId: string) => {
    if (!serverUrl || connectionStatus !== 'Connected') {
      setStatusMessage('Connect to the backend before redeeming a reward.');
      return;
    }

    setIsRedeeming(true);
    setStatusMessage('');

    try {
      const result = await createRedemption(serverUrl, selectedCustomerId, rewardId);
      setStatusMessage(`Reward redeemed successfully. ${result.pointsSpent} points used.`);
      await loadCustomerData(serverUrl, selectedCustomerId);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to redeem reward.';
      setStatusMessage(message);
    } finally {
      setIsRedeeming(false);
    }
  };

  const summary = useMemo(() => {
    if (!balance) {
      return {
        redeemableBalance: '—',
        lifetimeEarned: '—',
        tier: '—',
      };
    }

    return {
      redeemableBalance: `${balance.redeemableBalance} pts`,
      lifetimeEarned: `${balance.lifetimeEarned} pts`,
      tier: balance.tier,
    };
  }, [balance]);

  const renderHistoryItem = (entry: HistoryEntry) => (
    <View key={entry.id} style={styles.historyRow}>
      <View style={styles.historyInfo}>
        <Text style={styles.historyType}>{entry.entryType}</Text>
        <Text style={styles.historyDate}>{new Date(entry.createdAt).toLocaleString()}</Text>
      </View>
      <View style={styles.historyMeta}>
        <Text style={entry.pointsDelta >= 0 ? styles.pointsPositive : styles.pointsNegative}>
          {entry.pointsDelta >= 0 ? '+' : ''}
          {entry.pointsDelta}
        </Text>
        <Text style={styles.historyBalance}>Balance {entry.balanceAfter}</Text>
      </View>
    </View>
  );

  return (
    <>
      <StatusBar barStyle="dark-content" />
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.header}>Loyalty Rewards</Text>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Backend Server</Text>
          <TextInput
            value={serverInput}
            onChangeText={setServerInput}
            placeholder="192.168.1.105:3000"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            style={styles.input}
          />

          <View style={styles.actionRow}>
            <Button title={isConnecting ? 'Connecting...' : 'Connect'} onPress={handleConnect} disabled={isConnecting} />
          </View>

          <Text style={styles.statusLabel}>Status: {connectionStatus}</Text>
          {!!statusMessage && <Text style={styles.statusText}>{statusMessage}</Text>}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Customer</Text>
          <View style={styles.customerGrid}>
            {CUSTOMERS.map((customer) => (
              <Pressable
                key={customer.id}
                onPress={() => setSelectedCustomerId(customer.id)}
                style={[
                  styles.customerButton,
                  selectedCustomerId === customer.id && styles.customerButtonSelected,
                ]}
              >
                <Text
                  style={[
                    styles.customerButtonText,
                    selectedCustomerId === customer.id && styles.customerButtonTextSelected,
                  ]}
                >
                  {customer.name}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Summary</Text>

          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Redeemable Balance</Text>
            <Text style={styles.summaryValue}> {summary.redeemableBalance}</Text>
          </View>

          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Lifetime Earned</Text>
            <Text style={styles.summaryValue}> {summary.lifetimeEarned}</Text>
          </View>

          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Tier</Text>
            <Text style={styles.summaryValue}> {summary.tier}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Purchase</Text>
          <TextInput
            value={purchaseAmount}
            onChangeText={setPurchaseAmount}
            placeholder="Enter PKR amount"
            keyboardType="numeric"
            style={styles.input}
          />
          <Button title={isPurchasing ? 'Processing...' : 'Make Purchase'} onPress={handlePurchase} disabled={isPurchasing} />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Rewards</Text>
          {REWARDS.map((reward) => (
            <View key={reward.id} style={styles.rewardRow}>
              <View style={styles.rewardInfo}>
                <Text style={styles.rewardName}>{reward.name}</Text>
                <Text style={styles.rewardPoints}>{reward.pointsCost} points</Text>
              </View>
              <Button title={isRedeeming ? 'Redeeming...' : 'Redeem'} onPress={() => handleRedemption(reward.id)} disabled={isRedeeming} />
            </View>
          ))}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>History</Text>
          {isLoadingCustomer ? (
            <Text style={styles.emptyText}>Loading history...</Text>
          ) : history.length === 0 ? (
            <Text style={styles.emptyText}>No history available.</Text>
          ) : (
            history.map(renderHistoryItem)
          )}
        </View>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    paddingBottom: 40,
    backgroundColor: '#f5f7fb',
  },
  header: {
    fontSize: 32,
    fontWeight: '700',
    marginBottom: 20,
    color: '#111827',
  },
  section: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 18,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
    color: '#111827',
  },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
    backgroundColor: '#fff',
    color: '#000',
  },
  actionRow: {
    marginBottom: 8,
  },
  statusLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  statusText: {
    marginTop: 8,
    color: '#b91c1c',
    fontSize: 14,
    fontWeight: '500',
  },
  customerGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  customerButton: {
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: 8,
    marginBottom: 8,
  },
  customerButtonSelected: {
    backgroundColor: '#2563eb',
    borderColor: '#2563eb',
  },
  customerButtonText: {
    color: '#374151',
    fontWeight: '600',
  },
  customerButtonTextSelected: {
    color: '#fff',
  },
  summaryCard: {
    backgroundColor: '#eef2ff',
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
  },
  summaryLabel: {
    color: '#4b5563',
    fontSize: 12,
    marginBottom: 4,
  },
  summaryValue: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111827',
  },
  rewardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  rewardInfo: {
    flex: 1,
  },
  rewardName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  rewardPoints: {
    color: '#6b7280',
    marginTop: 2,
  },
  historyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  historyInfo: {
    flex: 1,
  },
  historyType: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
  },
  historyDate: {
    color: '#6b7280',
    fontSize: 12,
    marginTop: 2,
  },
  historyMeta: {
    alignItems: 'flex-end',
  },
  historyBalance: {
    color: '#4b5563',
    fontSize: 12,
    marginTop: 2,
  },
  pointsPositive: {
    color: '#16a34a',
    fontWeight: '700',
  },
  pointsNegative: {
    color: '#dc2626',
    fontWeight: '700',
  },
  emptyText: {
    color: '#6b7280',
    fontSize: 14,
  },
});
