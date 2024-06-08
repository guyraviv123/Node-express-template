import {
  useApi,
  reactExtension,
  useCartLines,
  ChoiceList,
  Choice,
  BlockStack,
  InlineStack,
  Button,
  Form,
  Banner,
  Pressable,
  BlockSpacer,
  Checkbox,
  useCustomer,
  View,
  Spinner,
} from "@shopify/ui-extensions-react/checkout";
import { useEffect, useState } from "react";

export default reactExtension(
  'purchase.checkout.block.render',
  () => <Extension />,
);

function Extension() {
  const { query } = useApi();

  // States
  const Customer_Id = useCustomer();
  const cart = useCartLines();
  const extensionApi = useApi();
  const [checkedValues, setCheckedValues] = useState([]);
  const [apiUrl, setApiUrl] = useState(null);
  const [loading, setLoading] = useState(false);
  const [cartData, setCartData] = useState([]);
  const [bannerStatus, setBannerStatus] = useState("info");
  const [bannerTitle, setBannerTitle] = useState("Save your cart");
  const [CustomerId, setCustomerId] = useState(null);

  useEffect(() => {
    //console.log('customerId', Customer_Id);
    if (cart.length > 0 && extensionApi.extension.scriptUrl && Customer_Id.id) {
      const parsedUrl = new URL(extensionApi.extension.scriptUrl);
      const origin = parsedUrl.origin;
      const customerIdParts = Customer_Id.id.split('/');
      const customerIdNumber = customerIdParts[customerIdParts.length - 1];
      setApiUrl(origin);   
      setCartData(cart);   
      setCustomerId(customerIdNumber);
    }
  }, [cart, Customer_Id.id,extensionApi]);

  const handleSaveCart = async () => {
    try {
      setLoading(true);
      if (cart.length > 0 && checkedValues.length > 0 && apiUrl) {
        const cartResponse = await fetch(`${apiUrl}/proxy/save-cart`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
             productId: checkedValues ,
             CustomerId: CustomerId
          }),
        });

        if (!cartResponse.ok) {
          throw new Error('Failed to save cart');
        }

        const cartSaveResponse = await cartResponse.json();
        console.log('Cart updated successfully:', cartSaveResponse);
        setLoading(false);
        setBannerTitle("Success");
        setBannerStatus("success");
      } else {
        console.log('Cart is empty or API URL is missing');
      }
    } catch (error) {
      setBannerTitle("Error");
      setBannerStatus("critical");
      console.error('Error:', error);
      setLoading(false);
    }
  };

  const handleCheckboxChange = (productId, checked) => {
    console.log('handleCheckboxChange value:', checked , productId);
    if (checked) {
      setCheckedValues((prevValues) => [...prevValues, productId]);
    } else {
      setCheckedValues((prevValues) => prevValues.filter((item) => item !== productId));
    } 
  };

  return (
    <View padding="base" border="base">
      <Banner
        minBlockSize="100%"
        status={bannerStatus}
        title={bannerTitle}
      />
      {loading && <Spinner />} 
      <BlockSpacer spacing="loose" />
      {cartData.map(product => {  
        const productId = product.merchandise.id.split('/').pop();
        return (
          <Checkbox
            key={product.merchandise.id}
            id={productId}
            onChange={(event) => handleCheckboxChange(productId, event)}
          >
            {product.merchandise.title} 
          </Checkbox>
        );
      })}
      <BlockSpacer spacing="loose" />
      {!loading ? (
        <Button
          minBlockSize="100%"
          onPress={handleSaveCart}
        >
          Save 
        </Button>
      ) : (
        <Spinner Appearance="warning" />
      )}
    </View>
  );
}