import { Text, Pressable, PressableProps, View } from 'react-native';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

interface ButtonProps extends PressableProps {
  title: string;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  className?: string;
  textClassName?: string;
  icon?: React.ReactNode;
}

export function Button({ title, variant = 'primary', className, textClassName, icon, ...props }: ButtonProps) {
  const baseStyles = "py-3 px-6 rounded-lg items-center justify-center active:opacity-80 flex-row"; // Added flex-row
  const variants = {
    primary: "bg-blue-600",
    secondary: "bg-gray-200",
    outline: "border border-gray-300 bg-transparent",
    ghost: "bg-transparent"
  };
  const textStyles = {
    primary: "text-white font-bold",
    secondary: "text-gray-900 font-bold",
    outline: "text-gray-700 font-bold",
    ghost: "text-gray-500 font-medium"
  };

  return (
    <Pressable 
      className={twMerge(baseStyles, variants[variant], className)} 
      {...props}
    >
      {icon && <View className="mr-2">{icon}</View>}
      <Text className={twMerge(textStyles[variant], textClassName)}>{title}</Text>
    </Pressable>
  );
}
