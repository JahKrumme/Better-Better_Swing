import type { PlatformAdapter } from "./adapters";
export const high5Capabilities = Object.freeze({
  discoverOffers: "SUPPORTED_MANUAL",
  checkRewardAvailability: "SUPPORTED_MANUAL",
  readPromotionalBalance: "SUPPORTED_MANUAL",
  readRedeemableBalance: "SUPPORTED_MANUAL",
  claimReward: "SUPPORTED_MANUAL",
  executePromotionalPlay: "UNAVAILABLE",
  requestRedemption: "SUPPORTED_MANUAL",
} as const);
export class High5Adapter implements PlatformAdapter {
  capabilities = Object.freeze({
    CHECK_REWARD: false,
    CLAIM_REWARD: false,
    PLAY_PROMOTIONAL_BALANCE: false,
    REQUEST_REDEMPTION: false,
  });
  support = high5Capabilities;
  constructor(public platformId: string) {}
  private manual(action: string) {
    return Promise.resolve({
      executionMode: "MANUAL_REQUIRED",
      sourceType: "USER_OBSERVATION",
      action,
      url: "https://high5casino.com/",
      message:
        "Use High 5 yourself, then record the result. No credentials or authenticated automation.",
    });
  }
  discoverOffers() {
    return this.manual(
      "Review official public information using the explicit public-sync workflow.",
    );
  }
  checkRewardAvailability() {
    return this.manual("Check your inbox; currency and amount may vary.");
  }
  readPromotionalBalance() {
    return this.manual("Record current GC/SC and playable SC.");
  }
  readRedeemableBalance() {
    return this.manual(
      "Record operator-confirmed redeemable SC; otherwise UNKNOWN.",
    );
  }
  claimReward() {
    return this.manual(
      "Manually claim a free reward if available; never purchase.",
    );
  }
  executePromotionalPlay() {
    return Promise.reject(
      new Error(
        "UNAVAILABLE: no gameplay executor; manually record already-performed play.",
      ),
    );
  }
  requestRedemption() {
    return this.manual(
      "Manually redeem eligible free value through a purchase-free method.",
    );
  }
  assertAutomatic(capability: keyof typeof high5Capabilities) {
    throw new Error(
      `Unsupported automatic High 5 capability: ${capability}. Current official authorization and supported interface required.`,
    );
  }
}
