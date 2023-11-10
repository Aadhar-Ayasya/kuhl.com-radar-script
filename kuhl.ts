/*
    url: https://www.next.co.uk/
*/

import {
  dataLayerEvent,
  GoogleDataLayer,
} from "../lib/adapters/googleDataLayer";
import { CURRENCY } from "../lib/constants";
import { Insights } from "../lib/insights";
import {
  debounce,
  getMedianPrice,
  handleElementMutation,
  observe,
  RemovalHandler,
  stripCurrency,
} from "../lib/utils";

interface CheckoutItem {
  item_id: string;
  item_name: string;
  price: number;
  quantity: number;
}

interface PageViewItem {
  item_id?: string;
  item_name?: string;
  price?: number;
  index?: number;
  sku?: string;
}
const insights = new Insights();

export const EVENT_PROCESSOR_FUNCTIONS = {
  // search event
  search: (event: any) => event,
  // search results viewed eventventList
  view_item_list: (event: any) => {
    debugger;
    const eventList = event.ecommerce.items;
    const url2 = new URL(window.location.href);
    const query = url2.searchParams.get("q");
    console.log({
      event: "view_item_list",
      item_list_name: query === null ? event.item_list_id : query,
      is_colletion:
        event.item_list_id === "search_page"
          ? !event.item_list_id
          : !!event.item_list_id,
      items: eventList.map((item: any, index: any) => ({
        item_id: item.item_id,
        item_name: item.item_name,
        index: index,
      })),
    });
    console.log(event.item_list_id);
    return {
      event: "view_item_list",
      item_list_name: query === null ? event.item_list_id : query || undefined,
      is_colletion:
        event.item_list_id === "search_page"
          ? !event.item_list_id
          : !!event.item_list_id,
      items: eventList.map((item: any, index: any) => ({
        item_id: item.item_id,
        item_name: item.item_name,
        index: index,
      })),
    };
  },
  // product view event
  GA4ViewItem: (event: any) => {
    debugger;
    console.log({
      event: "view_item",
      items: [
        {
          item_id: event.items[0].item_id,
          item_name: event.items[0].item_name,
          price: event.items[0].price,
        },
      ],
    });
    return{
      event: "view_item",
      items: [
        {
          item_id: event.items[0].item_id,
          item_name: event.items[0].item_name,
          price: event.items[0].price,
        },
      ],
    }
    
  },
  // add to cart event
  add_to_cart: (event: any) => {
    debugger;
    console.log({
      event: "add_to_cart",
      items: {
        item_id: event.ecommerce.items[0].item_id,
        item_name:event.ecommerce.items[0].item_name ,
        price:event.ecommerce.items[0].price,}
    });
    return{
      event: "add_to_cart",
      items: {
        item_id: event.ecommerce.items[0].item_id,
        item_name:event.ecommerce.items[0].item_name ,
        price:event.ecommerce.items[0].price,}
    }
  },
  // purchase event
  purchase: (event: any) => event,
};

// _______________________________________________________
function getEventRadar() {
  // Check if there's already a data layer and if not declare an empty array
  window.radarDataLayer = window.radarDataLayer ?? [];
  const SEARCH_QUERY_PARAM = "q";

  function handleSearch(el: Element): RemovalHandler {
    const waitTime = 1000;
    const handleSearchInputChange = debounce((event: Event) => {
      const search_term = (event.target as HTMLInputElement).value;
      if (search_term) {
        window.radarDataLayer.push({ event: "search", search_term });
      }
      console.log("SEARCH", window.radarDataLayer);
    }, waitTime);
    el.addEventListener("input", handleSearchInputChange);
    return () => el.removeEventListener("input", handleSearchInputChange);
  }

  function handleSearchTermSuggestion(el: Element): RemovalHandler {
    const handleClick = (e: Event) => {
      const search_term = (e.currentTarget as HTMLElement)?.innerText || "";
      if (search_term !== "") {
        window.radarDataLayer.push({
          event: "search",
          search_term,
        });
      }
      console.log("SEARCH TERM SUGGESTION", window.radarDataLayer);
    };
    const suggestionLinks = el.querySelectorAll("li a");
    suggestionLinks.forEach((anchorElement) => {
      anchorElement?.addEventListener("click", handleClick);
    });
    return () => {
      suggestionLinks.forEach((anchorElement) => {
        anchorElement?.removeEventListener("click", handleClick);
      });
    };
  }

  const PRODUCT_LIST_PAGES = {
    CATEGORY: "CATEGORY",
    SEARCH: "SEARCH",
    CATEGORY_TITLE: "CATEGORY_TITLE",
  };
  const SELECTOR = {
    SEARCH_BOX2:
      "input.MuiInputBase-input.MuiInputBase-inputAdornedEnd.css-mnn31",
    SEARCH_BOX: "#search-input",
    PLP_CONTAINER:
      "ul.ResponsiveTiles-inner.ResponsiveTiles-root.css-glmnvt li a",
    [PRODUCT_LIST_PAGES.CATEGORY_TITLE]:
      '[class*="PLPCategory_categorydescription"] h1',
    PDP: ".MuiBox-root.css-1g09bj5",
    PDP_TITLE: ".MuiTypography-root.MuiTypography-body1.css-6zeo6b",
    PDP_PRICE: ".MuiTypography-root.MuiTypography-body1.css-gyxej4",
    PDP_ADD_TO_CART_BUTTON:
      ".MuiButton-root.MuiButton-contained.MuiButton-containedSecondary MuiButton-sizeMedium.MuiButton-containedSizeMedium.MuiButton-fullWidth.MuiButtonBase-root.css-eyaiip",
    SEARCH_RECOMMENDATION: "[data-testid=header-simple-recent-searches]",
    CHECKOUT_BUTTON: "button.delivery-options-cta__continue-button",
  };

  const EVENTS_MAP = {
    [PRODUCT_LIST_PAGES.CATEGORY]: "category_page",
    [PRODUCT_LIST_PAGES.SEARCH]: "search_results",
  };

  // CATEGORY PAGES
  function getCategoryName(): string {
    const title = document.querySelector<HTMLElement>(
      "[data-testid=plp-product-title] h1"
    )?.innerText;
    if (title) return title;
    return (
      document.querySelector<HTMLHeadingElement>(
        SELECTOR[PRODUCT_LIST_PAGES.CATEGORY_TITLE]
      )?.innerText ?? EVENTS_MAP[PRODUCT_LIST_PAGES.CATEGORY]
    );
  }

  // SEARCH RESULTS PAGE
  function isSearchPage(): boolean {
    const url = new URL(window.location.href);
    return Boolean(url.searchParams.get(SEARCH_QUERY_PARAM));
  }
  function handleProductList(el: Element): RemovalHandler {
    debugger;
    const parent = document.querySelector(
      "ul.ResponsiveTiles-inner.ResponsiveTiles-root.css-glmnvt"
    );
    const is_collection = !isSearchPage();
    const item_list_name = is_collection
      ? getCategoryName()
      : EVENTS_MAP[PRODUCT_LIST_PAGES.SEARCH];

    const productListElements = parent?.querySelectorAll(":scope > li");

    if (!productListElements) {
      return () => {}; // return if there are no products
    }

    const itemElements = Array.from(productListElements);

    let previousListCount = 0;

    for (let i = window.radarDataLayer.length; i > 0; i--) {
      const eventData: dataLayerEvent = window.radarDataLayer[i - 1];

      if (eventData?.event === "view_item_list") {
        previousListCount = eventData?.items?.length || 0;
        break;
      }
    }

    const currentListCount = itemElements.length;

    if (currentListCount > previousListCount) {
      const items: PageViewItem[] = itemElements.map((productEl, index) => {
        // console.log(productEl);
        const item_name = productEl.querySelector<HTMLElement>(
          '[data-automation-id="product-title"] '
        )?.innerText;

        const priceText =
          productEl.querySelector<HTMLElement>(
            '[data-automation-id="product-price"] .w_iUH7'
          )?.innerText || "";

        const price = () => {
          const priceParts = priceText.split("$");

          if (priceParts.length >= 2) {
            const priceWithDollarSign = "$" + priceParts[1];

            return priceWithDollarSign;
          }
        };

        const priceValue = price();

        const item_div = productEl.childNodes[0];
        //   const item_id = item_div.getAttribute("io-id");
        // console.log(item_id);
        return {
          // item_id,
          item_name,
          priceValue,
          index,
        };
      });

      window.radarDataLayer.push({
        event: "view_item_list",
        item_list_name,
        is_collection,
        items,
      });
      console.log("getProductListItems", window.radarDataLayer);
    }

    return () => {};
  }

  const getSKUfromUrl = (url = window.location.href) => {
    const productUrl = new URL(url);
    const pathName = productUrl.pathname.split("/");
    return pathName[pathName.length - 1];
  };

  // PDP and ADD TO CART
  function handleViewItem(el: Element): RemovalHandler {
    const getItemName = () =>
      el.querySelector<HTMLHeadingElement>(SELECTOR.PDP_TITLE)?.innerText;
    const getPrice = () =>
      getMedianPrice(
        el.querySelector<HTMLElement>(SELECTOR.PDP_PRICE)?.innerText || "0"
      );

    const hasPriceRange = () => {
      const priceText =
        el.querySelector<HTMLElement>(SELECTOR.PDP_PRICE)?.innerText || "0";
      return priceText.includes("-");
    };
    const getItemId = () => {
      let itemId =
        el.querySelector<HTMLHeadingElement>("article")?.dataset.targetitem ||
        el.querySelector<HTMLHeadingElement>("[data-style-itemid]")?.dataset
          .styleItemid;
      return itemId?.replace("-", "");
    };

    window.radarDataLayer.push({
      event: "view_item",
      items: [
        {
          item_id: getSKUfromUrl(),
          item_name: getItemName(),
          price: getPrice(),
        },
      ],
    });
    console.log("PRODUCT DETAIL PAGE", window.radarDataLayer);

    const addToCartBtn = el.querySelector(SELECTOR.PDP_ADD_TO_CART_BUTTON);
    const handleClick = () => {
      // again get details as user can change color / size

      const price = !hasPriceRange()
        ? getPrice()
        : stripCurrency(
            el
              .querySelector<HTMLElement>("[id^=dk_container_Size] a")
              ?.innerText.split("-")[1] || "0"
          );
      window.radarDataLayer.push({
        event: "add_to_cart",
        items: [
          {
            item_id: getItemId(),
            item_name: getItemName(),
            price,
          },
        ],
      });
      console.log("ADD TO CART", window.radarDataLayer);
    };
    addToCartBtn?.addEventListener("click", handleClick);
    return () => addToCartBtn?.removeEventListener("click", handleClick);
  }

  function handlePurchase(buttonEl: Element): RemovalHandler {
    const handleClick = () => {
      let items: CheckoutItem[] = [];
      document
        .querySelectorAll(".order-summary__body-table tbody tr")
        .forEach((el: Element) => {
          const price = stripCurrency(
            el.querySelector<HTMLElement>(
              ".order-summary__body-table-td.order-summary__body-table-last-col span"
            )?.innerText || ""
          );
          const sku = el.querySelector<HTMLAnchorElement>(
            ".order-summary__body-table-description .text-nowrap"
          )?.innerText!;
          const quantity =
            el.querySelector<HTMLInputElement>("td:nth-child(4)")?.innerText ||
            "0";
          const title =
            el.querySelector<HTMLElement>(".order-summary__item-description")
              ?.innerText || "";

          items.push({
            item_id: sku.replace(/[\(\)\-\]']+/g, ""),
            item_name: title,
            price,
            quantity: parseInt(quantity),
          });
        });
      window.radarDataLayer.push({
        event: "purchase",
        transaction_id: new Date().getTime(),
        currency: CURRENCY.GBP,
        items,
      });
      console.log("CHECKOUT", window.radarDataLayer);
    };
    buttonEl.addEventListener("click", handleClick);
    return () => buttonEl.removeEventListener("click", handleClick);
  }

  function initProductList() {
    const url2 = new URL(window.location.href);
    const query = url2.searchParams.get(SEARCH_QUERY_PARAM);

    const targetNode = document.querySelector<HTMLElement>(
      SELECTOR.PLP_CONTAINER
    );

    if (!targetNode) {
      // if not on PLP page then return
      return;
    }

    //   handleProductList(targetNode);

    // observes new items injected in DOM when user scrolls
    handleElementMutation(targetNode, handleProductList);
  }

  // initProductList();

  observe({
    [SELECTOR.SEARCH_BOX]: handleSearch,
    [SELECTOR.SEARCH_BOX2]: handleSearch,
    [SELECTOR.PDP]: handleViewItem,
    [SELECTOR.SEARCH_RECOMMENDATION]: handleSearchTermSuggestion,
    [SELECTOR.CHECKOUT_BUTTON]: handlePurchase,
    //   [SELECTOR.PLP_CONTAINER]: handleProductList,
  });
}

/* INITIALISATION */
if (document.readyState !== "loading") {
  getEventRadar();
} else {
  document.addEventListener("DOMContentLoaded", getEventRadar);
}

insights.registerEventProcessorFunctions(EVENT_PROCESSOR_FUNCTIONS);
insights.start([new GoogleDataLayer("radarDataLayer"), new GoogleDataLayer()]);
