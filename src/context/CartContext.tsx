import { createContext, useContext, useState } from "react";
import type { ReactNode } from "react";

// 1. Define the shape of our context
interface CartContextType {
  cart: Record<string, number>;
  updateCartQty: (product: any, delta: number) => void;
  clearCart: () => void;
  cartItemsCount: number;
}

// 2. Create the Context
const CartContext = createContext<CartContextType | undefined>(undefined);

// 3. Create the Provider Component
export function CartProvider({ children }: { children: ReactNode }) {
  const [cart, setCart] = useState<Record<string, number>>({});

  const updateCartQty = (product: any, delta: number) => {
    setCart((prev) => {
      const currentQty = prev[product.id] || 0;
      const newQty = Math.max(0, currentQty + delta);
      const newCart = { ...prev };
      
      if (newQty === 0) delete newCart[product.id];
      else newCart[product.id] = newQty;
      
      return newCart;
    });
  };

  const clearCart = () => setCart({});

  const cartItemsCount = Object.values(cart).reduce((sum, qty) => sum + qty, 0);

  return (
    <CartContext.Provider value={{ cart, updateCartQty, clearCart, cartItemsCount }}>
      {children}
    </CartContext.Provider>
  );
}

// 4. Create a custom hook for easy access
export function useCart() {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error("useCart must be used within a CartProvider");
  }
  return context;
}
