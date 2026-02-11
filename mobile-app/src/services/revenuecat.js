import Purchases from 'react-native-purchases';
import { Platform } from 'react-native';

const REVENUECAT_IOS_KEY = process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY;
const REVENUECAT_ANDROID_KEY = process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY;
const ENTITLEMENT_ID = 'premium';

export const revenueCatClient = {
  initialize: () => {
    const apiKey = Platform.OS === 'ios' ? REVENUECAT_IOS_KEY : REVENUECAT_ANDROID_KEY;
    if (!apiKey) return;
    Purchases.configure({ apiKey });
  },

  identify: async (appUserId) => {
    await Purchases.logIn(appUserId);
  },

  reset: async () => {
    await Purchases.logOut();
  },

  getOfferings: async () => {
    const offerings = await Purchases.getOfferings();
    return offerings;
  },

  purchase: async (packageToPurchase) => {
    try {
      const { customerInfo } = await Purchases.purchasePackage(packageToPurchase);
      const isPremium = customerInfo.entitlements.active[ENTITLEMENT_ID] !== undefined;
      return { success: isPremium, customerInfo };
    } catch (error) {
      if (error.userCancelled) {
        return { success: false, error: 'cancelled' };
      }
      return { success: false, error: error.message || 'Purchase failed' };
    }
  },

  getCustomerInfo: async () => {
    return await Purchases.getCustomerInfo();
  },

  isPremium: async () => {
    try {
      const customerInfo = await Purchases.getCustomerInfo();
      return customerInfo.entitlements.active[ENTITLEMENT_ID] !== undefined;
    } catch {
      return false;
    }
  },

  getManagementURL: async () => {
    const customerInfo = await Purchases.getCustomerInfo();
    return customerInfo.managementURL;
  },
};
