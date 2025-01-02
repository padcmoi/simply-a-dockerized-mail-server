require ["fileinto","mailbox"];

if header :contains "X-Spam-Status" "Yes" {
fileinto :create "Junk";
stop;
}