import type { PlatformAdapter } from "./adapters";
// Manual consumer bookkeeping is supported; no authenticated executor is implemented.
export class RealPrizeAdapter implements PlatformAdapter {
  readonly capabilities = Object.freeze({
    CHECK_REWARD: false,
    CLAIM_REWARD: false,
    PLAY_PROMOTIONAL_BALANCE: false,
    REQUEST_REDEMPTION: false,
  });
  readonly automatic = Object.freeze({
    DISCOVERY: false,
    AVAILABILITY: false,
    BALANCE: false,
    CLAIM: false,
    GAMEPLAY: false,
    REDEMPTION: false,
  });
  constructor(public platformId: string) {}
  private manual(action: string) {
    return Promise.resolve({
      executionMode: "MANUAL_REQUIRED",
      action,
      url: "https://realprize.com/",
      message:
        "Open RealPrize yourself and record what actually happened. No automatic account access.",
    });
  }
  discoverOffers() {
    return this.manual("Review current official free terms.");
  }
  checkRewardAvailability() {
    return this.manual("Check for a free daily reward.");
  }
  readPromotionalBalance() {
    return this.manual("Record the actual promotional balance.");
  }
  readRedeemableBalance() {
    return this.manual("Record operator-confirmed redeemable value.");
  }
  claimReward() {
    return this.manual("Claim a genuinely free reward yourself.");
  }
  executePromotionalPlay() {
    return Promise.reject(
      new Error("No authorized supported gameplay interface."),
    );
  }
  requestRedemption() {
    return this.manual("Request a redemption using a purchase-free method.");
  }
}
