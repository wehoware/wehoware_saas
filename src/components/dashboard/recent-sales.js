"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export function RecentSales() {
  return (
    <div className="space-y-8">
      <div className="flex items-center">
        <Avatar className="h-9 w-9 mr-3">
          {/* <AvatarImage src="/avatars/01.png" alt="Avatar" /> */}
          <AvatarFallback>JS</AvatarFallback>
        </Avatar>
        <div className="space-y-1">
          <p className="text-sm font-medium leading-none">John Smith</p>
          <p className="text-sm text-muted-foreground">
            Business Immigration
          </p>
        </div>
        <div className="ml-auto font-medium">12m ago</div>
      </div>
      <div className="flex items-center">
        <Avatar className="h-9 w-9 mr-3">
          {/* <AvatarImage src="/avatars/02.png" alt="Avatar" /> */}
          <AvatarFallback>EJ</AvatarFallback>
        </Avatar>
        <div className="space-y-1">
          <p className="text-sm font-medium leading-none">Emily Johnson</p>
          <p className="text-sm text-muted-foreground">Student Visa</p>
        </div>
        <div className="ml-auto font-medium">47m ago</div>
      </div>
      <div className="flex items-center">
        <Avatar className="h-9 w-9 mr-3">
          {/* <AvatarImage src="/avatars/03.png" alt="Avatar" /> */}
          <AvatarFallback>RC</AvatarFallback>
        </Avatar>
        <div className="space-y-1">
          <p className="text-sm font-medium leading-none">Robert Chen</p>
          <p className="text-sm text-muted-foreground">Family Sponsorship</p>
        </div>
        <div className="ml-auto font-medium">1h ago</div>
      </div>
      <div className="flex items-center">
        <Avatar className="h-9 w-9 mr-3">
          {/* <AvatarImage src="/avatars/04.png" alt="Avatar" /> */}
          <AvatarFallback>SG</AvatarFallback>
        </Avatar>
        <div className="space-y-1">
          <p className="text-sm font-medium leading-none">Sophia Garcia</p>
          <p className="text-sm text-muted-foreground">Permanent Residence</p>
        </div>
        <div className="ml-auto font-medium">3h ago</div>
      </div>
      <div className="flex items-center">
        <Avatar className="h-9 w-9 mr-3">
          {/* <AvatarImage src="/avatars/05.png" alt="Avatar" /> */}
          <AvatarFallback>AK</AvatarFallback>
        </Avatar>
        <div className="space-y-1">
          <p className="text-sm font-medium leading-none">Alex Kim</p>
          <p className="text-sm text-muted-foreground">Work Permit</p>
        </div>
        <div className="ml-auto font-medium">5h ago</div>
      </div>
    </div>
  );
}
