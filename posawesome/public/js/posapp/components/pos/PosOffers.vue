<template>
  <div>
    <v-card class="selection mx-auto bg-grey-lighten-5" style="max-height: 80vh; height: 80vh">
      <v-card-title>
        <span class="text-h6 text-primary">{{ __('Offers') }}</span>
      </v-card-title>
      <div class="my-0 py-0 overflow-y-auto" style="max-height: 75vh" @mouseover="style = 'cursor: pointer'">
        <v-data-table :headers="items_headers" :items="pos_offers" :single-expand="singleExpand"
          v-model:expanded="expanded" show-expand item-key="row_id" class="elevation-1" :items-per-page="itemsPerPage"
          hide-default-footer>
          <template v-slot:item.offer_applied="{ item }">
            <v-checkbox-btn
              :model-value="item.offer_applied"
              @click.stop="toggleOfferApplied(item)"
              :disabled="(item.offer == 'Give Product' &&
                          !item.give_item &&
                          (!item.replace_cheapest_item || !item.replace_item)) ||
                        (item.offer == 'Grand Total' &&
                          discount_percentage_offer_name &&
                          discount_percentage_offer_name != item.name)">
            </v-checkbox-btn>
          </template>
          <template v-slot:expanded-item="{ headers, item }">
            <td :colspan="headers.length">
              <v-row class="mt-2">
                <v-col v-if="item.description">
                  <div class="text-primary" v-html="handleNewLine(item.description)"></div>
                </v-col>
                <v-col v-if="item.offer == 'Give Product'">
                  <v-autocomplete v-model="item.give_item" :items="get_give_items(item)" item-title="item_code"
                    variant="outlined" density="compact" color="primary" :label="frappe._('Give Item')" :disabled="item.apply_type != 'Item Group' ||
                      item.replace_item ||
                      item.replace_cheapest_item
                      "></v-autocomplete>
                </v-col>
              </v-row>
            </td>
          </template>
        </v-data-table>
      </div>
    </v-card>

    <v-card flat style="max-height: 11vh; height: 11vh" class="cards mb-0 mt-3 py-0">
      <v-row align="start" no-gutters>
        <v-col cols="12">
          <v-btn block class="pa-1" size="large" color="warning" theme="dark" @click="back_to_invoice">{{ __('Back')
            }}</v-btn>
        </v-col>
      </v-row>
    </v-card>
  </div>
</template>

<script>

import format from '../../format';
export default {
  mixins: [format],
  data: () => ({
    loading: false,
    pos_profile: '',
    pos_offers: [],
    allItems: [],
    discount_percentage_offer_name: null,
    itemsPerPage: 1000,
    expanded: [],
    singleExpand: true,
    items_headers: [
      { title: __('Name'), value: 'name', align: 'start' },
      { title: __('Apply On'), value: 'apply_on', align: 'start' },
      { title: __('Offer'), value: 'offer', align: 'start' },
      { title: __('Applied'), value: 'offer_applied', align: 'start' },
    ],
  }),

  computed: {
    offersCount() {
      return this.pos_offers.length;
    },
    appliedOffersCount() {
      return this.pos_offers.filter((el) => !!el.offer_applied).length;
    },
  },

  methods: {
    back_to_invoice() {
      this.eventBus.emit('show_offers', 'false');
    },
    forceUpdateItem() {
      let list_offers = [];
      list_offers = [...this.pos_offers];
      this.pos_offers = list_offers;
    },
    toggleOfferApplied(item) {
  console.log(`🔄 Toggling offer: ${item.name}, current state: ${item.offer_applied}`);
  
  // Toggle the current state (check/uncheck)
  item.offer_applied = !item.offer_applied;
  
  console.log(`✅ New state: ${item.offer_applied}`);
  
  // Force update the UI
  this.$forceUpdate();
  
  // Handle the offer application/removal
  this.handleOfferToggle(item);
  
  // Update counters and emit events
  this.handelOffers();
  this.updateCounters();
  this.updatePosCoupuns();
},
handleOfferToggle(item) {
  if (item.offer_applied) {
    // Offer is being applied
    console.log(`🎯 Applying offer: ${item.name}`);
    this.eventBus.emit('apply_individual_offer', item);
  } else {
    // Offer is being removed
    console.log(`🗑️ Removing offer: ${item.name}`);
    this.eventBus.emit('remove_individual_offer', item);
  }
},
    makeid(length) {
      let result = '';
      const characters = 'abcdefghijklmnopqrstuvwxyz0123456789';
      const charactersLength = characters.length;
      for (var i = 0; i < length; i++) {
        result += characters.charAt(
          Math.floor(Math.random() * charactersLength)
        );
      }
      return result;
    },
    updatePosOffers(offers) {
  console.log('📋 Updating POS offers list with auto_apply control...');
  
  const toRemove = [];
  
  // Check for offers that are no longer available
  this.pos_offers.forEach((pos_offer) => {
    const offer = offers.find((offer) => offer.name === pos_offer.name);
    if (!offer) {
      console.log(`❌ Offer no longer available: ${pos_offer.name}`);
      toRemove.push(pos_offer.row_id);
    }
  });
  
  // Remove offers that are no longer available
  this.removeOffers(toRemove);
  
  // Update existing offers or add new ones
  offers.forEach((offer) => {
    const pos_offer = this.pos_offers.find(
      (pos_offer) => offer.name === pos_offer.name
    );
    
    if (pos_offer) {
      // Update existing offer
      pos_offer.items = offer.items;
      
      // CRITICAL: Set offer_applied based on auto_apply field
      if (offer.auto_apply !== undefined) {
        // If this is a new evaluation and auto_apply is false, 
        // don't automatically check the offer
        if (!pos_offer.offer_applied && offer.auto_apply === false) {
          pos_offer.offer_applied = false;
          console.log(`📝 Offer ${offer.name} available but not auto-checked (auto_apply = false)`);
        }
        // If auto_apply is true and offer is not already applied, auto-check it
        else if (!pos_offer.offer_applied && offer.auto_apply === true) {
          pos_offer.offer_applied = true;
          console.log(`🤖 Auto-checking offer: ${offer.name} (auto_apply = true)`);
        }
        // If already applied, keep current state (don't override user's manual action)
      }
      
      // Handle special offer types
      if (
        offer.apply_on == 'Item Group' &&
        offer.apply_type == 'Item Group' &&
        offer.replace_cheapest_item
      ) {
        pos_offer.give_item = offer.give_item;
        pos_offer.apply_item_code = offer.apply_item_code;
      }
      
    } else {
      // Add new offer
      const newOffer = { ...offer };
      
      if (!offer.row_id) {
        newOffer.row_id = this.makeid(20);
      }
      
      if (offer.apply_type == 'Item Code') {
        newOffer.give_item = offer.apply_item_code || 'Nothing';
      }
      
      // CRITICAL: Set initial applied state based on auto_apply field
      if (offer.auto_apply !== undefined) {
        newOffer.offer_applied = !!offer.auto_apply;
        
        if (offer.auto_apply) {
          console.log(`🤖 New offer auto-checked: ${offer.name} (auto_apply = true)`);
        } else {
          console.log(`📝 New offer available for manual selection: ${offer.name} (auto_apply = false)`);
        }
      } else {
        // Fallback logic for offers without auto_apply field
        if (
          offer.apply_type == 'Item Group' &&
          offer.offer == 'Give Product' &&
          !offer.replace_cheapest_item &&
          !offer.replace_item
        ) {
          newOffer.offer_applied = false;
        } else if (
          offer.offer === 'Grand Total' &&
          this.discount_percentage_offer_name
        ) {
          newOffer.offer_applied = false;
        } else {
          newOffer.offer_applied = !!offer.auto;
        }
      }
      
      if (newOffer.offer == 'Give Product' && !newOffer.give_item) {
        const giveItems = this.get_give_items(newOffer);
        if (giveItems && giveItems.length > 0) {
          newOffer.give_item = giveItems[0].item_code;
        }
      }
      
      this.pos_offers.push(newOffer);
      
      // Only show "new offer" message for manual offers
      if (!newOffer.offer_applied) {
        this.eventBus.emit('show_message', {
          title: __('New Offer Available'),
          text: __(`${newOffer.name} - Check to apply`),
          color: 'info',
        });
      }
    }
  });
  
  // Force update and recalculate counters
  this.$forceUpdate();
  this.updateCounters();
},
applyOfferManually(offer) {
  console.log(`🎯 Manually applying offer: ${offer.name} (auto_apply: ${offer.auto_apply})`);
  
  try {
    if (offer.apply_on === "Buy Get Free") {
      this.ApplyBuyGetFreeOffer(offer);
    } else if (offer.offer === "Item Price") {
      this.ApplyOnPrice(offer);
    } else if (offer.offer === "Give Product") {
      this.applyGiveProductOffer(offer);
    } else if (offer.offer === "Grand Total") {
      this.ApplyOnTotal(offer);
    }

    // Add to applied offers if not already there
    const existingIndex = this.posa_offers.findIndex(o => 
      o.offer_name === offer.name || o.row_id === offer.row_id
    );

    if (existingIndex === -1) {
      const newOffer = {
        offer_name: offer.name,
        row_id: offer.row_id || this.makeid(10),
        apply_on: offer.apply_on,
        offer: offer.offer,
        items: JSON.stringify(offer.items || []),
        give_item: offer.give_item,
        give_item_row_id: offer.give_item_row_id,
        offer_applied: 1,
        coupon_based: offer.coupon_based || 0,
        coupon: offer.coupon || '',
        auto_applied: offer.auto_apply || false  // Track whether this was auto-applied
      };
      
      this.posa_offers.push(newOffer);
      this.addOfferToItems(newOffer);
      
      // Show appropriate message based on auto_apply
      if (offer.auto_apply) {
        console.log(`🤖 Auto-applied offer: ${offer.name}`);
      } else {
        console.log(`👤 Manually applied offer: ${offer.name}`);
        this.eventBus.emit("show_message", {
          title: __(`Offer Applied: ${offer.name}`),
          color: "success"
        });
      }
    }

    this.$forceUpdate();
    
  } catch (error) {
    console.error(`❌ Error applying offer ${offer.name}:`, error);
  }
},
shouldAutoApplyOffer(offer) {
  // Check if offer has auto_apply field and it's true
  if (offer.auto_apply !== undefined) {
    return offer.auto_apply === true || offer.auto_apply === 1;
  }
  
  // Fallback to existing auto logic if auto_apply field doesn't exist
  return !!offer.auto;
},

    removeOffers(offers_id_list) {
      this.pos_offers = this.pos_offers.filter(
        (offer) => !offers_id_list.includes(offer.row_id)
      );
    },
    handelOffers() {
      const applyedOffers = this.pos_offers.filter(
        (offer) => offer.offer_applied
      );
      this.eventBus.emit('update_invoice_offers', applyedOffers);
    },
    handleNewLine(str) {
      if (str) {
        return str.replace(/(?:\r\n|\r|\n)/g, '<br />');
      } else {
        return '';
      }
    },
    get_give_items(offer) {
      if (offer.apply_type == 'Item Code') {
        return [offer.apply_item_code];
      } else if (offer.apply_type == 'Item Group') {
        const items = this.allItems;
        let filterd_items = [];
        const filterd_items_1 = items.filter(
          (item) => item.item_group == offer.apply_item_group
        );
        if (offer.less_then > 0) {
          filterd_items = filterd_items_1.filter(
            (item) => item.rate < offer.less_then
          );
        } else {
          filterd_items = filterd_items_1;
        }
        return filterd_items;
      } else {
        return [];
      }
    },
    updateCounters() {
      this.eventBus.emit('update_offers_counters', {
        offersCount: this.offersCount,
        appliedOffersCount: this.appliedOffersCount,
      });
    },
    updatePosCoupuns() {
      const applyedOffers = this.pos_offers.filter(
        (offer) => offer.offer_applied && offer.coupon_based
      );
      this.eventBus.emit('update_pos_coupons', applyedOffers);
    },
  },

  watch: {
    posOffers: {
    deep: true,
    handler() {
      console.log('🔄 Offer list updated, re-evaluating...');
      this.evaluateAndApplyOffers();
    }
  }

  },


  created: function () {
    this.$nextTick(function () {
      this.eventBus.on('register_pos_profile', (data) => {
        this.pos_profile = data.pos_profile;
      });
    });
    this.eventBus.on('update_customer', (customer) => {
      if (this.customer != customer) {
        this.offers = [];
      }
    });
    this.eventBus.on('update_pos_offers', (data) => {
      this.updatePosOffers(data);
    });
    this.eventBus.on('update_discount_percentage_offer_name', (data) => {
      this.discount_percentage_offer_name = data.value;
    });
    this.eventBus.on('set_all_items', (data) => {
      this.allItems = data;
    });
  },
};



</script>