import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export enum ModalSize {
  sm = "sm:max-w-[425px]",
  md = "md:max-w-[625px]",
  lg = "lg:max-w-[825px]",
}

type ModalType = {
  triggerButton: React.ReactNode;
  title: string;
  description?: string;
  onSubmit?: (e: React.FormEvent) => void;
  isSubmitting?: boolean;
  size?: ModalSize.sm;
  children: React.ReactNode;
};

export function Modal({
  triggerButton,
  title,
  description,
  onSubmit,
  isSubmitting,
  size = ModalSize.sm,
  children,
}: ModalType) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        {triggerButton ? (
          triggerButton
        ) : (
          <Button variant="outline">Open</Button>
        )}
      </DialogTrigger>

      <DialogContent className={size}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="grid gap-4">
          <div>{children}</div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button type="submit">{isSubmitting ? "Saving..." : "Save"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
